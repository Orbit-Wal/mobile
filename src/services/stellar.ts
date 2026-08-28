import * as StellarSdk from "@stellar/stellar-sdk";
import { NETWORKS, useNetworkStore } from "@/store/networkStore";
import { cacheAccountSequence, getCachedAccountSequence } from "@/services/accountCache";
import { enqueuePayment, flushQueue } from "@/services/paymentQueue";
import type { NetworkConfig, NetworkId } from "@/types";

// Issue #19: network selection used to be two module constants read once
// at import time -- a build-time-only choice, not a runtime switcher.
// Every function below reads useNetworkStore.getState() fresh on each
// call instead, so there is no module-level value that can go stale when
// the user flips networks mid-session; see src/store/networkStore.ts for
// where the switch itself (and offline-queue invalidation) happens.
function getActiveConfig(): NetworkConfig {
  return useNetworkStore.getState().getConfig();
}

// One Horizon.Server instance per network, created lazily and reused --
// avoids reconstructing it on every call while still never risking a
// server pointed at the wrong horizonUrl for the currently active network.
const serversByNetwork = new Map<NetworkId, StellarSdk.Horizon.Server>();
export function getServerForNetwork(networkId: NetworkId): StellarSdk.Horizon.Server {
  const existing = serversByNetwork.get(networkId);
  if (existing) return existing;
  const created = new StellarSdk.Horizon.Server(NETWORKS[networkId].horizonUrl);
  serversByNetwork.set(networkId, created);
  return created;
}

export type StellarServiceErrorCode =
  | "INVALID_PUBLIC_KEY"
  | "ACCOUNT_NOT_FOUND"
  | "NETWORK_ERROR"
  | "ENTROPY_UNAVAILABLE"
  | "NO_PATH_FOUND";

/**
 * Wraps every failure mode getAccount/getBalances can hit in one typed error
 * so callers (UI code) can show a specific message instead of a generic
 * "something went wrong" -- an unfunded testnet account (404, expected and
 * recoverable by funding it) looks nothing like a malformed address or a
 * dropped connection, and shouldn't be presented the same way.
 */
export class StellarServiceError extends Error {
  code: StellarServiceErrorCode;

  constructor(message: string, code: StellarServiceErrorCode) {
    super(message);
    this.name = "StellarServiceError";
    this.code = code;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 300;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new StellarServiceError(`${label} timed out after ${timeoutMs}ms.`, "NETWORK_ERROR"));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Retries only NETWORK_ERROR-classified failures (timeouts, dropped
 * connections, 5xx) with exponential backoff. INVALID_PUBLIC_KEY and
 * ACCOUNT_NOT_FOUND are deliberately not retried -- the answer won't change
 * without user action, so retrying would just add latency.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = DEFAULT_RETRIES): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isRetryable = err instanceof StellarServiceError ? err.code === "NETWORK_ERROR" : true;
      if (!isRetryable || attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * 2 ** attempt));
    }
  }
  throw lastErr;
}

/**
 * @stellar/stellar-sdk generates keys via tweetnacl, which requires
 * `crypto.getRandomValues` to be present *before* it's first imported --
 * see index.js, which loads the react-native-get-random-values polyfill
 * ahead of expo-router/entry for exactly this reason. If that polyfill is
 * ever removed, or a future refactor imports stellar.ts from a module
 * evaluated before the polyfill runs, tweetnacl silently and permanently
 * disables its PRNG and Keypair.random() starts throwing "no PRNG" --
 * this check turns that into an explicit, diagnosable error instead.
 */
function assertSecureRandomAvailable(): void {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
    throw new StellarServiceError(
      "Secure random number generation is unavailable on this device " +
        "(crypto.getRandomValues is missing). Wallet creation cannot proceed " +
        "safely. This should never happen in a build that loads index.js's " +
        "react-native-get-random-values polyfill before expo-router/entry.",
      "ENTROPY_UNAVAILABLE"
    );
  }
}

export function generateKeypair(): StellarSdk.Keypair {
  assertSecureRandomAvailable();
  return StellarSdk.Keypair.random();
}

export async function getAccount(publicKey: string) {
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
    throw new StellarServiceError(
      `"${publicKey}" is not a valid Stellar public key.`,
      "INVALID_PUBLIC_KEY"
    );
  }

  const config = getActiveConfig();
  const server = getServerForNetwork(config.id);

  const account = await withRetry(async () => {
    try {
      return await withTimeout(server.loadAccount(publicKey), DEFAULT_TIMEOUT_MS, "loadAccount");
    } catch (err) {
      if (err instanceof StellarSdk.NotFoundError) {
        throw new StellarServiceError(
          "This account has not been funded on the network yet.",
          "ACCOUNT_NOT_FOUND"
        );
      }
      if (err instanceof StellarServiceError) throw err;
      throw new StellarServiceError(
        "Could not reach the Stellar network. Check your connection and try again.",
        "NETWORK_ERROR"
      );
    }
  });

  // Issue #14: this is the "prior fetch" the offline-signing design relies
  // on -- every successful load refreshes the cached sequence number so
  // sendPayment() can still build+sign a transaction later even with no
  // connectivity at send time.
  await cacheAccountSequence(config.id, publicKey, account.sequenceNumber());

  return account;
}

export async function getBalances(publicKey: string): Promise<Record<string, string>> {
  const account = await getAccount(publicKey);
  const result: Record<string, string> = {};
  for (const balance of account.balances) {
    if (balance.asset_type === "native") {
      result["XLM"] = balance.balance;
    } else if ("asset_code" in balance) {
      result[balance.asset_code] = balance.balance;
    }
  }
  return result;
}

export type SendPaymentResult =
  | { status: "submitted"; response: StellarSdk.Horizon.HorizonApi.SubmitTransactionResponse }
  // Issue #14: instead of throwing a bare exception when the device is
  // offline, sendPayment signs locally (using a cached sequence number if a
  // fresh loadAccount() isn't reachable) and hands the signed XDR to the
  // local outbox for opportunistic broadcast later -- see paymentQueue.ts.
  | { status: "queued"; queueId: string };

export async function sendPayment(params: {
  sourceSecretKey: string;
  destinationPublicKey: string;
  asset: StellarSdk.Asset;
  amount: string;
  memo?: string;
}): Promise<SendPaymentResult> {
  // Note on key material lifetime (issue #37): sourceSecretKey and
  // sourceKeypair are ordinary JS values here. JS strings are immutable and
  // GC timing isn't controllable from userland, so there is no way to
  // force-wipe them from memory the instant signing finishes -- this
  // function just avoids holding extra copies or logging them, which is
  // the practical ceiling for zeroization in a JS/Hermes runtime.
  const { sourceSecretKey, destinationPublicKey, asset, amount, memo } = params;
  const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey);
  const sourcePublicKey = sourceKeypair.publicKey();

  // Network context is captured once, up front, and used for every step of
  // this call (signing AND the eventual queue entry) -- this is the fix for
  // the issue #19 replay-risk scenario: a network switch that happens after
  // this point can never retroactively change what passphrase this
  // particular transaction was signed with.
  const config = getActiveConfig();
  const server = getServerForNetwork(config.id);

  let sourceAccount: Awaited<ReturnType<typeof getAccount>> | StellarSdk.Account;
  try {
    sourceAccount = await getAccount(sourcePublicKey);
  } catch (err) {
    if (!(err instanceof StellarServiceError) || err.code !== "NETWORK_ERROR") throw err;
    // Offline (or Horizon unreachable): fall back to the last sequence we
    // saw for this account on this network. Without a cached value there's
    // nothing safe to sign against, so the original error is the right
    // thing to surface.
    const cached = await getCachedAccountSequence(config.id, sourcePublicKey);
    if (!cached) throw err;
    sourceAccount = new StellarSdk.Account(sourcePublicKey, cached.sequence);
  }

  // BASE_FEE (100 stroops) is the network minimum, not a real fee estimate --
  // it's routinely insufficient during surge pricing, when transactions with
  // only the base fee get starved out of the ledger. fetchBaseFee() asks
  // Horizon for the fee actually required by recent ledger congestion; if
  // that call fails for any reason (including being offline) we fall back to
  // BASE_FEE so this doesn't block signing entirely.
  let fee: string = StellarSdk.BASE_FEE;
  try {
    fee = String(await server.fetchBaseFee());
  } catch {
    // Fall back to BASE_FEE.
  }

  const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationPublicKey,
        asset,
        amount,
      })
    )
    // 180s rather than the previous 30s: a transaction that ends up queued
    // offline (rather than submitted immediately) needs a timebound wide
    // enough to survive until the next reconnect flush. This is still
    // finite -- if the device stays offline past the window, Horizon will
    // reject the eventual broadcast as tx_too_late, which flushQueue()
    // surfaces as a failed, resend-required item rather than silently
    // dropping or retrying it. A perfect solution needs either a much
    // longer window or re-signing on flush (which would require holding the
    // secret key for the queue's lifetime, a strictly worse tradeoff) --
    // left as a follow-up.
    .setTimeout(180);
  if (memo) builder.addMemo(StellarSdk.Memo.text(memo));
  const tx = builder.build();
  tx.sign(sourceKeypair);
  const signedXdr = tx.toXDR();

  try {
    // Deliberately no retry here, unlike getAccount: if submitTransaction's
    // response is lost after Horizon already applied the transaction, blindly
    // retrying could double-submit. A timeout still applies so a hung request
    // doesn't leave the caller waiting forever.
    const response = await withTimeout(server.submitTransaction(tx), DEFAULT_TIMEOUT_MS, "submitTransaction");
    return { status: "submitted", response };
  } catch (err) {
    const looksLikeNetworkFailure =
      err instanceof StellarServiceError
        ? err.code === "NETWORK_ERROR"
        : !(err && typeof err === "object" && "response" in err); // has a parsed Horizon response => real rejection, not offline

    if (!looksLikeNetworkFailure) throw err;

    // Couldn't reach Horizon to submit -- this is the offline path. The
    // transaction is already signed, so instead of throwing it away we
    // persist it and let it broadcast opportunistically once connectivity
    // returns (app/_layout.tsx's NetInfo listener + paymentQueue.flushQueue).
    const queued = await enqueuePayment({
      signedXdr,
      networkId: config.id,
      networkPassphrase: config.networkPassphrase,
      sourcePublicKey,
      destinationPublicKey,
      assetCode: asset.isNative() ? "XLM" : asset.getCode(),
      assetIssuer: asset.isNative() ? undefined : asset.getIssuer(),
      amount,
      sequence: sourceAccount.sequenceNumber(),
    });
    return { status: "queued", queueId: queued.id };
  }
}

/**
 * Wires paymentQueue.flushQueue() up to this module's per-network server
 * cache and the live network store, so callers (the NetInfo
 * reconnect listener in app/_layout.tsx, and pull-to-refresh on home.tsx)
 * don't need to know either of those exist. Always reads the network id at
 * call time -- see flushQueue's own per-item mismatch check for why that
 * matters.
 */
export async function flushPendingPayments() {
  return flushQueue(getServerForNetwork, () => useNetworkStore.getState().network);
}

// --- SEP-29: memo-required destinations (issue #24) ---------------------

/**
 * SEP-29 (https://stellar.org/protocol/sep-29) has exchanges/custodians
 * mark deposit accounts with an account "data entry" whose key is exactly
 * `config.memo_required`. This checks for the *presence* of that key --
 * not its decoded value -- because that's the convention real-world
 * destinations (and other wallets checking for it) actually follow, and
 * because failing to warn a user about to send to a memo-required address
 * is a far worse failure mode than an occasional over-cautious warning.
 */
export async function checkMemoRequired(destinationPublicKey: string): Promise<boolean> {
  try {
    const account = await getAccount(destinationPublicKey);
    const dataAttr = (account as unknown as { data_attr?: Record<string, string> }).data_attr ?? {};
    return Object.prototype.hasOwnProperty.call(dataAttr, "config.memo_required");
  } catch (err) {
    if (err instanceof StellarServiceError && err.code === "ACCOUNT_NOT_FOUND") {
      // An unfunded account can't carry data entries -- nothing to warn about.
      return false;
    }
    throw err;
  }
}

// --- Path payments (issue #25) -------------------------------------------

/** Never allow an unbounded destMin (0) or sendMax (infinite) -- slippage is
 * always applied, and this is the widest tolerance a caller can request even
 * if they pass something larger. */
const MAX_SLIPPAGE_BPS = 5000; // 50%
export const DEFAULT_SLIPPAGE_BPS = 100; // 1%

function clampSlippageBps(bps: number): number {
  if (!Number.isFinite(bps) || bps < 0) return DEFAULT_SLIPPAGE_BPS;
  return Math.min(bps, MAX_SLIPPAGE_BPS);
}

/**
 * Applies a slippage tolerance to an expected counter-asset amount to derive
 * a `destMin` (strict-send) or `sendMax` (strict-receive) bound.
 *
 * Uses plain floating point rather than a fixed-point/BigNumber library --
 * Stellar amounts cap at 7 decimal places, so we round outward (floor for a
 * minimum, ceil for a maximum) to that precision, which is close enough for
 * a slippage *tolerance* (as opposed to the exact amount itself, which is
 * always taken from the user-entered string, never recomputed here).
 */
function applySlippage(expectedAmount: string, slippageBps: number, direction: "min" | "max"): string {
  const bounded = clampSlippageBps(slippageBps);
  const value = parseFloat(expectedAmount);
  const factor = direction === "min" ? 1 - bounded / 10_000 : 1 + bounded / 10_000;
  const raw = value * factor;
  const scaled = direction === "min" ? Math.floor(raw * 1e7) : Math.ceil(raw * 1e7);
  const bound = Math.max(scaled, direction === "min" ? 0 : 1) / 1e7;
  return bound.toFixed(7);
}

/**
 * Finds strict-send payment paths (fixed source amount, variable
 * destination amount) via Horizon's path-finding endpoint. Throws a
 * NO_PATH_FOUND error -- rather than returning an empty array -- so callers
 * surface "no route exists" distinctly from a generic transaction failure,
 * per issue #25's DoD.
 */
export async function findStrictSendPaths(params: {
  sendAsset: StellarSdk.Asset;
  sendAmount: string;
  destinationPublicKey: string;
}): Promise<StellarSdk.Horizon.ServerApi.PaymentPathRecord[]> {
  const { sendAsset, sendAmount, destinationPublicKey } = params;
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(destinationPublicKey)) {
    throw new StellarServiceError(
      `"${destinationPublicKey}" is not a valid Stellar public key.`,
      "INVALID_PUBLIC_KEY"
    );
  }
  return withRetry(async () => {
    let response;
    try {
      response = await withTimeout(
        server.strictSendPaths(sendAsset, sendAmount, destinationPublicKey).call(),
        DEFAULT_TIMEOUT_MS,
        "strictSendPaths"
      );
    } catch (err) {
      if (err instanceof StellarServiceError) throw err;
      throw new StellarServiceError(
        "Could not reach the Stellar network to find a payment path. Check your connection and try again.",
        "NETWORK_ERROR"
      );
    }
    if (response.records.length === 0) {
      throw new StellarServiceError(
        "No payment path was found between these assets right now. Try a smaller amount or a different asset.",
        "NO_PATH_FOUND"
      );
    }
    return response.records;
  });
}

/**
 * Finds strict-receive payment paths (fixed destination amount, variable
 * source amount). See findStrictSendPaths for the NO_PATH_FOUND rationale.
 */
export async function findStrictReceivePaths(params: {
  sourcePublicKey: string;
  destAsset: StellarSdk.Asset;
  destAmount: string;
}): Promise<StellarSdk.Horizon.ServerApi.PaymentPathRecord[]> {
  const { sourcePublicKey, destAsset, destAmount } = params;
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(sourcePublicKey)) {
    throw new StellarServiceError(
      `"${sourcePublicKey}" is not a valid Stellar public key.`,
      "INVALID_PUBLIC_KEY"
    );
  }
  return withRetry(async () => {
    let response;
    try {
      response = await withTimeout(
        server.strictReceivePaths(sourcePublicKey, destAsset, destAmount).call(),
        DEFAULT_TIMEOUT_MS,
        "strictReceivePaths"
      );
    } catch (err) {
      if (err instanceof StellarServiceError) throw err;
      throw new StellarServiceError(
        "Could not reach the Stellar network to find a payment path. Check your connection and try again.",
        "NETWORK_ERROR"
      );
    }
    if (response.records.length === 0) {
      throw new StellarServiceError(
        "No payment path was found between these assets right now. Try a smaller amount or a different asset.",
        "NO_PATH_FOUND"
      );
    }
    return response.records;
  });
}

/**
 * Submits a path payment (cross-asset send). `expectedCounterAmount` should
 * come straight from the path-finding record the caller quoted (destination_amount
 * for strict-send, source_amount for strict-receive) -- slippageBps is then
 * applied on top of that quote to derive destMin/sendMax, so the bound is
 * always relative to a real quote and never unbounded (see applySlippage).
 */
export async function sendPathPayment(params: {
  sourceSecretKey: string;
  destinationPublicKey: string;
  sendAsset: StellarSdk.Asset;
  destAsset: StellarSdk.Asset;
  mode: "strictSend" | "strictReceive";
  amount: string;
  expectedCounterAmount: string;
  path?: StellarSdk.Asset[];
  slippageBps?: number;
  memo?: string;
}): Promise<StellarSdk.Horizon.HorizonApi.SubmitTransactionResponse> {
  const {
    sourceSecretKey,
    destinationPublicKey,
    sendAsset,
    destAsset,
    mode,
    amount,
    expectedCounterAmount,
    path = [],
    slippageBps = DEFAULT_SLIPPAGE_BPS,
    memo,
  } = params;

  const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey);
  const sourceAccount = await getAccount(sourceKeypair.publicKey());

  let fee: string = StellarSdk.BASE_FEE;
  try {
    fee = String(await server.fetchBaseFee());
  } catch {
    // Fall back to BASE_FEE.
  }

  const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (mode === "strictSend") {
    const destMin = applySlippage(expectedCounterAmount, slippageBps, "min");
    builder.addOperation(
      StellarSdk.Operation.pathPaymentStrictSend({
        sendAsset,
        sendAmount: amount,
        destination: destinationPublicKey,
        destAsset,
        destMin,
        path,
      })
    );
  } else {
    const sendMax = applySlippage(expectedCounterAmount, slippageBps, "max");
    builder.addOperation(
      StellarSdk.Operation.pathPaymentStrictReceive({
        sendAsset,
        sendMax,
        destination: destinationPublicKey,
        destAsset,
        destAmount: amount,
        path,
      })
    );
  }

  builder.setTimeout(30);
  if (memo) builder.addMemo(StellarSdk.Memo.text(memo));
  const tx = builder.build();
  tx.sign(sourceKeypair);
  // Same no-retry rationale as sendPayment above.
  return withTimeout(server.submitTransaction(tx), DEFAULT_TIMEOUT_MS, "submitTransaction");
}
