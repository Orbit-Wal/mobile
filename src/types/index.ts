export interface Transaction {
  id: string;
  type: "send" | "receive" | "swap";
  asset: string;
  amount: string;
  counterparty: string;
  timestamp: string;
  status: "pending" | "success" | "failed";
  memo?: string;
}

export interface WalletAccount {
  publicKey: string;
  label: string;
  balances: Record<string, string>;
}

export type NetworkId = "testnet" | "mainnet";

export interface NetworkConfig {
  id: NetworkId;
  label: string;
  horizonUrl: string;
  rpcUrl?: string;
  networkPassphrase: string;
  friendbotUrl?: string;
}

/**
 * A signed-but-not-yet-confirmed payment, persisted so it survives an app
 * restart while the device is offline (issue #14). `networkId`/
 * `networkPassphrase` pin down exactly which network context the signature
 * is valid for -- if the active network changes before this gets
 * broadcast, the queue must invalidate the item rather than resubmit it
 * under a different passphrase (issue #19's replay-risk concern).
 */
export interface QueuedPayment {
  id: string;
  signedXdr: string;
  networkId: NetworkId;
  networkPassphrase: string;
  sourcePublicKey: string;
  destinationPublicKey: string;
  assetCode: string;
  assetIssuer?: string;
  amount: string;
  /** The source account's sequence number consumed by this transaction. */
  sequence: string;
  createdAt: number;
  /**
   * "pending": waiting to be (re)tried. "submitting": a broadcast attempt is
   * in flight right now -- flushQueue() skips items in this state so a
   * second concurrent flush can never double-submit the same signed XDR.
   * "failed": broadcast was attempted and definitively rejected (bad
   * sequence, network mismatch, etc). Failed items are surfaced to the user
   * and removed, never silently retried.
   */
  status: "pending" | "submitting" | "failed";
  lastError?: string;
}

export interface Guardian {
  /** Stellar public key (G...). This is the signer identity, not a secret. */
  publicKey: string;
  /** Local-only display label. Never transmitted anywhere. */
  label: string;
  addedAt: string;
}

export interface RecoveryConfig {
  /** Number of guardian signatures required to authorize a signer-set change. */
  threshold: number;
  /** Delay, in seconds, a guardian-co-signed recovery transaction's minTime
   * is set to in the future, giving the real owner a window to notice and
   * intervene before it becomes submittable. */
  delaySeconds: number;
  enabledAt: string | null;
}

export interface PendingRecovery {
  /** Public key of the new device being recovered into. */
  newDevicePublicKey: string;
  /** minTime (unix seconds) before the co-signed transaction can submit. */
  readyAt: number;
  /** Guardian public keys that have provided a signature so far (local bookkeeping only —
   * the real quorum check happens on submission via Stellar's protocol-level threshold). */
  collectedSignatures: string[];
}
