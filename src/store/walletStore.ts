import { create } from "zustand";
import { deleteSecretKey, deleteWalletMeta, getWalletMeta, saveWalletMeta } from "@/services/secureStorage";

interface WalletState {
  isOnboarded: boolean;
  publicKey: string | null;
  balances: Record<string, string>;
  hydrated: boolean;
  /**
   * Reconstructs isOnboarded/publicKey from SecureStore on app launch.
   * Must be awaited before isOnboarded is trusted for routing -- see
   * app/index.tsx, which blocks its redirect on `hydrated`.
   */
  hydrate: () => Promise<void>;
  /** Persists the public key and marks onboarding complete in one step. */
  completeOnboarding: (publicKey: string) => Promise<void>;
  setOnboarded: (value: boolean) => void;
  setPublicKey: (key: string) => void;
  setBalances: (balances: Record<string, string>) => void;
  /**
   * Full logout: deletes the SecureStore secret and persisted wallet meta,
   * then clears in-memory state. Must be awaited by callers that navigate
   * away afterward, so the store never reports isOnboarded: false while the
   * secret is still on disk.
   */
  reset: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set) => ({
  isOnboarded: false,
  publicKey: null,
  balances: {},
  hydrated: false,

  hydrate: async () => {
    const publicKey = await getWalletMeta();
    set({ isOnboarded: publicKey !== null, publicKey, hydrated: true });
  },

  completeOnboarding: async (publicKey: string) => {
    await saveWalletMeta(publicKey);
    set({ publicKey, isOnboarded: true });
  },

  setOnboarded: (value) => set({ isOnboarded: value }),
  setPublicKey: (key) => set({ publicKey: key }),
  setBalances: (balances) => set({ balances }),

  reset: async () => {
    await Promise.all([deleteSecretKey(), deleteWalletMeta()]);
    set({ isOnboarded: false, publicKey: null, balances: {} });
  },
}));
