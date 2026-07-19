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
