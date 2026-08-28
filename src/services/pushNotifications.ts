import { useWalletStore } from "@/store/walletStore";
import { getBalances } from "@/services/stellar";

// Issue #13: there is no push infrastructure wired up in this app yet (no
// expo-notifications, no backend registration). This module exists so the
// *contract* a future implementation must follow is enforced in code, not
// just described in docs/design/push-notifications/PUSH_NOTIFICATIONS.md --
// read that doc first for the full privacy design and threat model.
//
// The one rule this file encodes: a push payload is allowed to say
// "something may have happened," and nothing else. It can never carry an
// address, an amount, a counterparty, or a memo -- those are only ever
// fetched by the app itself, over its own authenticated connection to
// Horizon, after the notification wakes it up.

/**
 * The only shape a push payload is ever allowed to have. Deliberately has
 * no address/amount/counterparty/memo fields -- see PUSH_NOTIFICATIONS.md
 * §2-3. `type` is left open for future non-financial signal types (e.g. a
 * security notice), but every variant must stay identity- and
 * amount-free.
 */
export interface PushNotificationPayload {
  type: "possible_activity" | "security_notice";
}

/**
 * Runtime guard so a malformed or tampered payload (e.g. a backend bug, or
 * a compromised push provider trying to smuggle real data through) can
 * never reach anything that renders it directly. Any key beyond `type` is
 * rejected rather than silently stripped, so a payload-shape violation
 * fails loudly (in dev/telemetry) instead of quietly leaking through a
 * refactor that forgets to re-check this.
 */
export function assertPrivacySafePayload(payload: unknown): PushNotificationPayload {
  if (
    !payload ||
    typeof payload !== "object" ||
    Object.keys(payload).some((key) => key !== "type") ||
    !("type" in payload) ||
    ((payload as { type: unknown }).type !== "possible_activity" &&
      (payload as { type: unknown }).type !== "security_notice")
  ) {
    throw new Error(
      "Push payload failed the privacy contract (expected only { type }). Refusing to process it -- " +
        "see docs/design/push-notifications/PUSH_NOTIFICATIONS.md."
    );
  }
  return payload as PushNotificationPayload;
}

/**
 * The only place transaction details are allowed to come from: a direct,
 * authenticated fetch against Horizon, using the public key already held
 * on-device -- never anything carried in the notification itself. Intended
 * to run when the app is opened/woken by a notification (once real push
 * infra exists); for now this is also exactly what a manual refresh does.
 */
export async function fetchActivityAfterNotification(): Promise<Record<string, string> | null> {
  const publicKey = useWalletStore.getState().publicKey;
  if (!publicKey) return null;
  return getBalances(publicKey);
}
