import { create } from "zustand";
import { getSecretKey } from "@/services/secureStorage";
import * as StellarSdk from "@stellar/stellar-sdk";

interface WalletState {
  isOnboarded: boolean;
  publicKey: string | null;
  balances: Record<string, string>;
  hydrated: boolean;
  setOnboarded: (value: boolean) => void;
  setPublicKey: (key: string) => void;
  setBalances: (balances: Record<string, string>) => void;
  reset: () => void;
  hydrate: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set) => ({
  isOnboarded: false,
  publicKey: null,
  balances: {},
  hydrated: false,

  setOnboarded: (value) => set({ isOnboarded: value }),
  setPublicKey: (key) => set({ publicKey: key }),
  setBalances: (balances) => set({ balances }),
  reset: () => set({ isOnboarded: false, publicKey: null, balances: {} }),

  hydrate: async () => {
    const secret = await getSecretKey();
    if (secret) {
      const keypair = StellarSdk.Keypair.fromSecret(secret);
      set({ isOnboarded: true, publicKey: keypair.publicKey(), hydrated: true });
    } else {
      set({ hydrated: true });
    }
  },
}));
