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

jest.mock("expo-device", () => ({
  isDevice: false,
  isRootedExperimentalAsync: jest.fn(async () => false),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));

import {
  saveSecretKey,
  getSecretKey,
  deleteSecretKey,
  saveWalletMeta,
  getWalletMeta,
  deleteWalletMeta,
} from "@/services/secureStorage";

describe("secureStorage", () => {
  afterEach(async () => {
    await deleteSecretKey();
    await deleteWalletMeta();
  });

  describe("saveSecretKey", () => {
    it("stores and retrieves a secret", async () => {
      await saveSecretKey("SSECRET1");
      expect(await getSecretKey()).toBe("SSECRET1");
    });

    it("throws SECRET_ALREADY_EXISTS instead of silently overwriting an existing secret", async () => {
      await saveSecretKey("SFIRST");
      await expect(saveSecretKey("SSECOND")).rejects.toThrow("SECRET_ALREADY_EXISTS");
      expect(await getSecretKey()).toBe("SFIRST");
    });

    it("allows overwrite when allowOverwrite: true is passed explicitly", async () => {
      await saveSecretKey("SFIRST");
      await saveSecretKey("SSECOND", { allowOverwrite: true });
      expect(await getSecretKey()).toBe("SSECOND");
    });

    it("does not require allowOverwrite when no secret is stored yet", async () => {
      await expect(saveSecretKey("SONLY")).resolves.toBeUndefined();
      expect(await getSecretKey()).toBe("SONLY");
    });
  });

  describe("deleteSecretKey", () => {
    it("removes a stored secret", async () => {
      await saveSecretKey("SSECRET1");
      await deleteSecretKey();
      expect(await getSecretKey()).toBeNull();
    });
  });

  describe("wallet meta (public key persistence)", () => {
    it("returns null before anything is saved", async () => {
      expect(await getWalletMeta()).toBeNull();
    });

    it("stores and retrieves the public key", async () => {
      await saveWalletMeta("GPUBLICKEY");
      expect(await getWalletMeta()).toBe("GPUBLICKEY");
    });

    it("deleteWalletMeta clears it", async () => {
      await saveWalletMeta("GPUBLICKEY");
      await deleteWalletMeta();
      expect(await getWalletMeta()).toBeNull();
    });
  });
});
