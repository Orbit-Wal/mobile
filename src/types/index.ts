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

export interface NetworkConfig {
  horizonUrl: string;
  rpcUrl: string;
  networkPassphrase: string;
  friendbotUrl?: string;
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
