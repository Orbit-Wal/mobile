import { create } from "zustand";
import {
  deleteSecretKey,
  deleteWalletMeta,
  getWalletMeta,
  saveWalletMeta,
  DEFAULT_ACCOUNT_ID,
  saveAccounts,
  loadAccounts,
  saveActiveAccountId,
  loadActiveAccountId,
  deleteAccounts,
  deleteActiveAccountId,
  deleteSecretKeyForAccount,
} from "@/services/secureStorage";
import type { Account } from "@/types";

// Multi-account support (issue #18). Root-cause: this store used to hardcode
// exactly one `publicKey`, and secureStorage.ts used one fixed SecureStore
// key for the secret -- there was no way to represent a second account at
// all. The fix keeps `publicKey`/`isOnboarded` as derived views of "the
// active account" (so every existing call site and the existing test suite,
// which reads/writes those fields directly, keeps working unmodified) while
// adding a real `accounts` list + `activeAccountId` pointer underneath.
//
// Migration: secureStorage.ts's per-account secret keys are namespaced as
// `${SECRET_KEY_STORAGE_KEY}_${accountId}`, except DEFAULT_ACCOUNT_ID, which
// resolves to the original unsuffixed key. hydrate() below detects an
// install with no `accounts` list yet but an existing legacy public key
// (saveWalletMeta's key) and synthesizes a single `{ id: DEFAULT_ACCOUNT_ID }`
// account from it once, persisting the accounts list from then on. A
// pre-#18 install's secret is therefore already under the right key with no
// data movement required.
interface WalletState {
  isOnboarded: boolean;
  /** Active account's public key. Kept for backward compatibility with
   * existing call sites/tests; equivalent to accounts.find(a => a.id === activeAccountId)?.publicKey. */
  publicKey: string | null;
  balances: Record<string, string>;
  hydrated: boolean;
  accounts: Account[];
  activeAccountId: string | null;
  /**
   * Reconstructs isOnboarded/publicKey/accounts from SecureStore on app launch.
   * Must be awaited before isOnboarded is trusted for routing -- see
   * app/index.tsx, which blocks its redirect on `hydrated`.
   */
  hydrate: () => Promise<void>;
  /** Persists the public key and marks onboarding complete in one step.
   * Creates the first account (DEFAULT_ACCOUNT_ID) and makes it active. */
  completeOnboarding: (publicKey: string) => Promise<void>;
  /** Registers an additional account (issue #18). The caller must already
   * have saved its secret via saveSecretKeyForAccount(account.id, ...)
   * before calling this -- this function only updates the accounts list. */
  addAccount: (account: Account) => Promise<void>;
  /** Switches the active account. Clears `balances`, since the previous
   * account's balances don't apply to the newly active one -- callers
   * should reload balances after switching. */
  switchAccount: (accountId: string) => Promise<void>;
  /** Removes an account and its stored secret. Throws if it's the only
   * account left (use reset() to fully log out instead). If the removed
   * account was active, switches to the first remaining account. */
  removeAccount: (accountId: string) => Promise<void>;
  setOnboarded: (value: boolean) => void;
  setPublicKey: (key: string) => void;
  setBalances: (balances: Record<string, string>) => void;
  /**
   * Full logout: deletes every account's SecureStore secret plus persisted
   * wallet/account metadata, then clears in-memory state. Must be awaited by
   * callers that navigate away afterward, so the store never reports
   * isOnboarded: false while a secret is still on disk.
   */
  reset: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  isOnboarded: false,
  publicKey: null,
  balances: {},
  hydrated: false,
  accounts: [],
  activeAccountId: null,

  hydrate: async () => {
    let accounts = await loadAccounts();
    let activeAccountId = await loadActiveAccountId();

    if (accounts.length === 0) {
      // Legacy single-account install migration (see class comment above).
      const legacyPublicKey = await getWalletMeta();
      if (legacyPublicKey) {
        const migrated: Account = {
          id: DEFAULT_ACCOUNT_ID,
          publicKey: legacyPublicKey,
          label: "Account 1",
        };
        accounts = [migrated];
        activeAccountId = migrated.id;
        await saveAccounts(accounts);
        await saveActiveAccountId(activeAccountId);
      }
    }

    const active = accounts.find((a) => a.id === activeAccountId) ?? accounts[0] ?? null;
    set({
      isOnboarded: accounts.length > 0,
      publicKey: active?.publicKey ?? null,
      accounts,
      activeAccountId: active?.id ?? null,
      hydrated: true,
    });
  },

  completeOnboarding: async (publicKey: string) => {
    await saveWalletMeta(publicKey); // legacy field, kept in sync for compat
    const account: Account = { id: DEFAULT_ACCOUNT_ID, publicKey, label: "Account 1" };
    await saveAccounts([account]);
    await saveActiveAccountId(account.id);
    set({ publicKey, isOnboarded: true, accounts: [account], activeAccountId: account.id });
  },

  addAccount: async (account: Account) => {
    const next = [...get().accounts, account];
    await saveAccounts(next);
    set({ accounts: next });
  },

  switchAccount: async (accountId: string) => {
    const account = get().accounts.find((a) => a.id === accountId);
    if (!account) return;
    await saveActiveAccountId(accountId);
    set({ activeAccountId: accountId, publicKey: account.publicKey, balances: {} });
  },

  removeAccount: async (accountId: string) => {
    const current = get().accounts;
    if (current.length <= 1) {
      throw new Error(
        "Can't remove the only account on this device. Use logout/reset to remove your last account."
      );
    }
    const next = current.filter((a) => a.id !== accountId);
    await deleteSecretKeyForAccount(accountId);
    await saveAccounts(next);

    let { activeAccountId } = get();
    let publicKey = get().publicKey;
    if (activeAccountId === accountId) {
      activeAccountId = next[0].id;
      publicKey = next[0].publicKey;
      await saveActiveAccountId(activeAccountId);
    }
    set({ accounts: next, activeAccountId, publicKey, balances: {} });
  },

  setOnboarded: (value) => set({ isOnboarded: value }),
  setPublicKey: (key) => set({ publicKey: key }),
  setBalances: (balances) => set({ balances }),

  reset: async () => {
    const { accounts } = get();
    await Promise.all([
      ...accounts.map((a) => deleteSecretKeyForAccount(a.id)),
      deleteSecretKey(), // covers a legacy secret that was never migrated into `accounts`
      deleteWalletMeta(),
      deleteAccounts(),
      deleteActiveAccountId(),
    ]);
    set({ isOnboarded: false, publicKey: null, balances: {}, accounts: [], activeAccountId: null });
  },
}));
