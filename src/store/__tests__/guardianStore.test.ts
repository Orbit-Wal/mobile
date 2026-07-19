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

import { useGuardianStore } from "@/store/guardianStore";

const guardianA = { publicKey: "GAAA1111111111111111111111111111111111111111111111AAAA", label: "Alice", addedAt: "2026-01-01T00:00:00.000Z" };
const guardianB = { publicKey: "GBBB2222222222222222222222222222222222222222222222BBBB", label: "Bob", addedAt: "2026-01-01T00:00:00.000Z" };

beforeEach(() => {
  useGuardianStore.setState({ guardians: [], recoveryConfig: null, pendingRecovery: null, hydrated: false });
});

describe("guardianStore", () => {
  it("adds a guardian and persists it", async () => {
    await useGuardianStore.getState().addGuardian(guardianA);
    expect(useGuardianStore.getState().guardians).toEqual([guardianA]);
  });

  it("rejects adding the same guardian public key twice", async () => {
    await useGuardianStore.getState().addGuardian(guardianA);
    await expect(useGuardianStore.getState().addGuardian(guardianA)).rejects.toThrow(
      "already been added"
    );
    expect(useGuardianStore.getState().guardians).toHaveLength(1);
  });

  it("removes a guardian when no recovery is enabled", async () => {
    await useGuardianStore.getState().addGuardian(guardianA);
    await useGuardianStore.getState().removeGuardian(guardianA.publicKey);
    expect(useGuardianStore.getState().guardians).toHaveLength(0);
  });

  it("blocks removing a guardian if it would drop below the enabled threshold", async () => {
    await useGuardianStore.getState().addGuardian(guardianA);
    await useGuardianStore.getState().addGuardian(guardianB);
    await useGuardianStore
      .getState()
      .setRecoveryConfig({ threshold: 2, delaySeconds: 3600, enabledAt: "2026-01-01T00:00:00.000Z" });

    await expect(useGuardianStore.getState().removeGuardian(guardianA.publicKey)).rejects.toThrow(
      "threshold"
    );
    expect(useGuardianStore.getState().guardians).toHaveLength(2);
  });

  it("allows removing a guardian if recovery was never enabled, even below a configured threshold", async () => {
    await useGuardianStore.getState().addGuardian(guardianA);
    await useGuardianStore.getState().addGuardian(guardianB);
    await useGuardianStore
      .getState()
      .setRecoveryConfig({ threshold: 2, delaySeconds: 3600, enabledAt: null });

    await useGuardianStore.getState().removeGuardian(guardianA.publicKey);
    expect(useGuardianStore.getState().guardians).toHaveLength(1);
  });
});
