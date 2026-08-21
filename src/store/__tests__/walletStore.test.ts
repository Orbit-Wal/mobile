jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "whenUnlockedThisDeviceOnly",
  };
});

import { useWalletStore } from "@/store/walletStore";
import { getWalletMeta } from "@/services/secureStorage";

const PUBLIC_KEY = "GAAA1111111111111111111111111111111111111111111111AAAA";

beforeEach(async () => {
  useWalletStore.setState({
    isOnboarded: false,
    publicKey: null,
    balances: {},
    hydrated: false,
  });
  // Clear anything persisted by a previous test.
  await useWalletStore.getState().reset();
  useWalletStore.setState({ hydrated: false });
});

describe("walletStore", () => {
  it("starts unhydrated and not onboarded", () => {
    const state = useWalletStore.getState();
    expect(state.hydrated).toBe(false);
    expect(state.isOnboarded).toBe(false);
    expect(state.publicKey).toBeNull();
  });

  it("hydrate() reports not onboarded when nothing is persisted", async () => {
    await useWalletStore.getState().hydrate();
    const state = useWalletStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.isOnboarded).toBe(false);
    expect(state.publicKey).toBeNull();
  });

  it("completeOnboarding persists the public key and flips isOnboarded", async () => {
    await useWalletStore.getState().completeOnboarding(PUBLIC_KEY);
    const state = useWalletStore.getState();
    expect(state.isOnboarded).toBe(true);
    expect(state.publicKey).toBe(PUBLIC_KEY);
    expect(await getWalletMeta()).toBe(PUBLIC_KEY);
  });

  it("hydrate() reconstructs onboarding state after a simulated cold restart", async () => {
    await useWalletStore.getState().completeOnboarding(PUBLIC_KEY);

    // Simulate a fresh app launch: in-memory state resets, persisted
    // storage does not.
    useWalletStore.setState({ isOnboarded: false, publicKey: null, hydrated: false });
    await useWalletStore.getState().hydrate();

    const state = useWalletStore.getState();
    expect(state.isOnboarded).toBe(true);
    expect(state.publicKey).toBe(PUBLIC_KEY);
  });

  it("reset() clears both in-memory state and the persisted public key", async () => {
    await useWalletStore.getState().completeOnboarding(PUBLIC_KEY);
    await useWalletStore.getState().reset();

    const state = useWalletStore.getState();
    expect(state.isOnboarded).toBe(false);
    expect(state.publicKey).toBeNull();
    expect(state.balances).toEqual({});
    expect(await getWalletMeta()).toBeNull();
  });

  it("setBalances updates balances independently of onboarding state", () => {
    useWalletStore.getState().setBalances({ XLM: "100" });
    expect(useWalletStore.getState().balances).toEqual({ XLM: "100" });
  });
});
