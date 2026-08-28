import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NetworkId } from "@/types";

const CACHE_STORAGE_KEY = "globewallet_account_sequence_cache";

// Issue #14's design assumes signing can happen offline "given the
// sequence number is already known from a prior fetch" -- this module is
// that memory. getAccount() (stellar.ts) updates it on every successful
// load; sendPayment() falls back to it when a fresh loadAccount() fails
// because the device is offline. Scoped per network id, since a sequence
// number from testnet says nothing about the same public key on mainnet.
interface CacheEntry {
  sequence: string;
  loadedAt: number;
}

type Cache = Partial<Record<NetworkId, Record<string, CacheEntry>>>;

async function readCache(): Promise<Cache> {
  const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Cache;
  } catch {
    return {};
  }
}

export async function cacheAccountSequence(
  networkId: NetworkId,
  publicKey: string,
  sequence: string
): Promise<void> {
  const cache = await readCache();
  const forNetwork = cache[networkId] ?? {};
  forNetwork[publicKey] = { sequence, loadedAt: Date.now() };
  cache[networkId] = forNetwork;
  await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
}

export async function getCachedAccountSequence(
  networkId: NetworkId,
  publicKey: string
): Promise<CacheEntry | null> {
  const cache = await readCache();
  return cache[networkId]?.[publicKey] ?? null;
}
