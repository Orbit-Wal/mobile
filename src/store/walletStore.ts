import { create } from "zustand";

interface WalletState {
  isOnboarded: boolean;
  publicKey: string | null;
  balances: Record<string, string>;
  setOnboarded: (value: boolean) => void;
  setPublicKey: (key: string) => void;
  setBalances: (balances: Record<string, string>) => void;
  reset: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  isOnboarded: false,
  publicKey: null,
  balances: {},
  setOnboarded: (value) => set({ isOnboarded: value }),
  setPublicKey: (key) => set({ publicKey: key }),
  setBalances: (balances) => set({ balances }),
  reset: () => set({ isOnboarded: false, publicKey: null, balances: {} }),
}));
