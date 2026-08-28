import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as StellarSdk from "@stellar/stellar-sdk";
import type { NetworkId, QueuedPayment } from "@/types";

const QUEUE_STORAGE_KEY = "globewallet_payment_queue";

// Issue #14: sendPayment() previously had no offline story at all -- a lost
// connection mid-send just threw. This module is the local "outbox": a
// signed-but-unbroadcast transaction is written here (survives app
// restart, since it's AsyncStorage-backed, not in-memory), and
// flushQueue() opportunistically retries broadcast whenever connectivity
// returns (wired up in app/_layout.tsx's NetInfo listener).
//
// Double-broadcast safety: every item transitions pending -> submitting ->
// (removed | failed), and the whole read-modify-write of the queue array
// happens inside `withQueueLock` below. A second flushQueue() call that
// starts while one is already running waits for the lock rather than
// reading a stale copy of the queue and re-submitting an item the first
// call already marked "submitting". This matters in practice: NetInfo can
// fire multiple "back online" events in quick succession, and app/_layout
// also flushes once on cold start -- both could otherwise race.

async function readQueue(): Promise<QueuedPayment[]> {
  const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedPayment[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedPayment[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

// A simple in-process mutex. AsyncStorage has no atomic read-modify-write,
// so without this, two overlapping calls (e.g. a NetInfo event firing
// twice) could both read the queue before either writes it back, and one
// update would clobber the other.
let lock: Promise<unknown> = Promise.resolve();
function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  // Swallow rejections here so one failed op doesn't permanently wedge the
  // lock chain for subsequent callers; the real error still propagates to
  // this call's own caller via `run`.
  lock = run.catch(() => undefined);
  return run;
}

export async function getQueue(): Promise<QueuedPayment[]> {
  return readQueue();
}

export async function enqueuePayment(
  item: Omit<QueuedPayment, "id" | "createdAt" | "status">
): Promise<QueuedPayment> {
  return withQueueLock(async () => {
    const queue = await readQueue();
    const queued: QueuedPayment = {
      ...item,
      id: Crypto.randomUUID(),
      createdAt: Date.now(),
      status: "pending",
    };
    queue.push(queued);
    await writeQueue(queue);
    return queued;
  });
}

export async function removeFromQueue(id: string): Promise<void> {
  return withQueueLock(async () => {
    const queue = await readQueue();
    await writeQueue(queue.filter((item) => item.id !== id));
  });
}

/**
 * Called from networkStore.setNetwork() the instant the active network
 * changes. Any item signed for a different network than `currentNetworkId`
 * carries a signature over the wrong passphrase -- broadcasting it would
 * either be rejected by Horizon (different network entirely) or, in a
 * worse hypothetical, replay onto a network the user never intended. These
 * are marked "failed" with an explicit reason and left for the user to see
 * and dismiss, never silently dropped or silently resubmitted.
 */
export async function invalidateStaleQueueItems(currentNetworkId: NetworkId): Promise<void> {
  return withQueueLock(async () => {
    const queue = await readQueue();
    let changed = false;
    const next = queue.map((item) => {
      if (item.networkId !== currentNetworkId && item.status !== "failed") {
        changed = true;
        return {
          ...item,
          status: "failed" as const,
          lastError: `Signed for ${item.networkId}, but the active network is now ${currentNetworkId}. Discarded to avoid replaying it on the wrong network.`,
        };
      }
      return item;
    });
    if (changed) await writeQueue(next);
  });
}

function isNetworkError(err: unknown): boolean {
  // Horizon/fetch failures from a dropped connection don't come back as a
  // typed StellarServiceError here (we're calling submitTransaction
  // directly, not through stellar.ts's wrapper) -- treat anything without
  // a parsed Horizon error response as "couldn't reach the network", which
  // is the only case we want to retry later rather than mark failed.
  if (err && typeof err === "object" && "response" in err) return false;
  return true;
}

export interface FlushQueueResult {
  broadcast: string[];
  failed: { id: string; reason: string }[];
  stillPending: number;
}

/**
 * Attempts to broadcast every "pending" item. Safe to call opportunistically
 * (on reconnect, on cold start, on pull-to-refresh) -- items already
 * "submitting" or "failed" are skipped, and the network-mismatch check
 * happens per-item against whatever is active *right now*, not what was
 * active when the item was queued.
 */
export async function flushQueue(
  getServerForNetwork: (networkId: NetworkId) => StellarSdk.Horizon.Server,
  getActiveNetworkId: () => NetworkId
): Promise<FlushQueueResult> {
  const result: FlushQueueResult = { broadcast: [], failed: [], stillPending: 0 };

  // Snapshot which items we're willing to attempt, then process them one at
  // a time so each pending -> submitting transition is persisted before
  // the network call starts (so a crash mid-broadcast leaves the item
  // "submitting", visibly stuck rather than silently retried -- see the
  // note on that state below).
  const idsToTry = await withQueueLock(async () => {
    const queue = await readQueue();
    return queue.filter((item) => item.status === "pending").map((item) => item.id);
  });

  for (const id of idsToTry) {
    const activeNetworkId = getActiveNetworkId();

    const item = await withQueueLock(async () => {
      const queue = await readQueue();
      const found = queue.find((q) => q.id === id);
      if (!found || found.status !== "pending") return null;

      if (found.networkId !== activeNetworkId) {
        found.status = "failed";
        found.lastError = `Signed for ${found.networkId}, active network is ${activeNetworkId}.`;
        await writeQueue(queue);
        return null;
      }

      found.status = "submitting";
      await writeQueue(queue);
      return found;
    });

    if (!item) continue;

    try {
      const server = getServerForNetwork(item.networkId);
      const tx = StellarSdk.TransactionBuilder.fromXDR(item.signedXdr, item.networkPassphrase);
      await server.submitTransaction(tx);
      await removeFromQueue(id);
      result.broadcast.push(id);
    } catch (err) {
      const horizonExtras =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { extras?: { result_codes?: unknown } } } }).response?.data?.extras
              ?.result_codes
          : undefined;
      const isBadSequence = JSON.stringify(horizonExtras ?? "").includes("tx_bad_seq");

      if (isBadSequence) {
        // The account moved on-chain since we signed (another transaction
        // consumed this sequence number) -- this signed XDR can never
        // succeed as-is. Surface it, don't retry it, and don't silently
        // drop it either.
        await withQueueLock(async () => {
          const queue = await readQueue();
          const found = queue.find((q) => q.id === id);
          if (found) {
            found.status = "failed";
            found.lastError =
              "This account's sequence number has changed on-chain since this payment was signed " +
              "(another transaction went through first). It cannot be retried automatically -- please resend.";
            await writeQueue(queue);
          }
        });
        result.failed.push({ id, reason: "bad_sequence" });
      } else if (isNetworkError(err)) {
        // Still offline (or Horizon unreachable) -- revert to pending so
        // the next flush (next reconnect event) tries again. Deliberately
        // does NOT retry in a loop right now, matching sendPayment's
        // existing no-blind-retry-on-submit stance elsewhere in this file.
        await withQueueLock(async () => {
          const queue = await readQueue();
          const found = queue.find((q) => q.id === id);
          if (found && found.status === "submitting") found.status = "pending";
          await writeQueue(queue);
        });
        result.stillPending += 1;
      } else {
        await withQueueLock(async () => {
          const queue = await readQueue();
          const found = queue.find((q) => q.id === id);
          if (found) {
            found.status = "failed";
            found.lastError = err instanceof Error ? err.message : "Broadcast failed for an unknown reason.";
            await writeQueue(queue);
          }
        });
        result.failed.push({ id, reason: "rejected" });
      }
    }
  }

  return result;
}
