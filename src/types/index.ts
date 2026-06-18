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
