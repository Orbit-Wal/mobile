import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StellarSdk from "@stellar/stellar-sdk";
import type { NetworkConfig, NetworkId } from "@/types";
import { invalidateStaleQueueItems } from "@/services/paymentQueue";

const ACTIVE_NETWORK_STORAGE_KEY = "globewallet_active_network";

// Issue #19: network selection has to live in this session-model store, not
// a module-level constant read once at import time (the old
// stellar.ts:HORIZON_URL/NETWORK_PASSPHRASE pattern) -- a module constant
// can't be changed at runtime, which is exactly why no switcher existed
// before this. Every network-aware call site (stellar.ts) reads
// useNetworkStore.getState() fresh on every call, so there is no code path
// that can hold a stale passphrase from the previously active network.
export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  testnet: {
    id: "testnet",
    label: "Testnet",
    horizonUrl: process.env.EXPO_PUBLIC_TESTNET_HORIZON_URL ?? "https://horizon-testnet.stellar.org",
    networkPassphrase: StellarSdk.Networks.TESTNET,
  },
  mainnet: {
    id: "mainnet",
    label: "Mainnet",
    horizonUrl: process.env.EXPO_PUBLIC_MAINNET_HORIZON_URL ?? "https://horizon.stellar.org",
    networkPassphrase: StellarSdk.Networks.PUBLIC,
  },
};

// Testnet is the only safe default: an app that silently defaulted to
// mainnet (e.g. because storage was empty on first launch) could let a
// user send real funds before ever touching a network setting.
const DEFAULT_NETWORK: NetworkId = "testnet";

interface NetworkState {
  network: NetworkId;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /**
   * Switches the active network and, in the same call, invalidates any
   * offline-queued payments signed under the network being left -- see
   * services/paymentQueue.ts. This is the one place a network switch
   * happens, so it's also the one place that invalidation can be
   * guaranteed to run rather than relying on every future call site to
   * remember to check.
   */
  setNetwork: (id: NetworkId) => Promise<void>;
  getConfig: () => NetworkConfig;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  network: DEFAULT_NETWORK,
  hydrated: false,

  hydrate: async () => {
    const stored = await AsyncStorage.getItem(ACTIVE_NETWORK_STORAGE_KEY);
    const network: NetworkId = stored === "mainnet" || stored === "testnet" ? stored : DEFAULT_NETWORK;
    set({ network, hydrated: true });
  },

  setNetwork: async (id: NetworkId) => {
    const previous = get().network;
    if (previous === id) return;
    await AsyncStorage.setItem(ACTIVE_NETWORK_STORAGE_KEY, id);
    set({ network: id });
    // Any transaction signed while `previous` was active carries that
    // network's passphrase baked into its signature -- it is not valid
    // (and must never be silently resubmitted) under `id`'s passphrase.
    await invalidateStaleQueueItems(id);
  },

  getConfig: () => NETWORKS[get().network],
}));
