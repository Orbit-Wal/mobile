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

/**
 * One locally-stored account (issue #18). `id` is the storage-key namespace
 * used by secureStorage.ts's per-account secret functions -- it is NOT the
 * public key, so an account's secret can be rotated/reimported without
 * changing the account's identity in the switcher UI. `id === "default"` is
 * reserved for the account migrated from a pre-multi-account single-wallet
 * install (see walletStore.ts's hydrate()).
 */
export interface Account {
  id: string;
  publicKey: string;
  label: string;
}

/**
 * A saved recipient address (issue #20). See src/services/addressBook.ts
 * for the storage-tier rationale (SecureStore, not AsyncStorage).
 */
export interface Contact {
  id: string;
  label: string;
  address: string;
  createdAt: string;
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
