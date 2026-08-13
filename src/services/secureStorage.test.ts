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
  isDevice: true,
  isRootedExperimentalAsync: jest.fn(async () => false),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));
jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
}));
jest.mock("./localAuth", () => ({
  requireLocalAuth: jest.fn(),
  LocalAuthRequiredError: class extends Error {},
}));

import { getSecretKey, saveSecretKey } from "./secureStorage";
import { requireLocalAuth, LocalAuthRequiredError } from "./localAuth";
import * as SecureStore from "expo-secure-store";

const mockedRequireLocalAuth = requireLocalAuth as jest.Mock;

describe("secureStorage secret reads are gated", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires local auth before returning the stored secret", async () => {
    mockedRequireLocalAuth.mockResolvedValue(true);
    await saveSecretKey("S" + "A".repeat(55));

    const secret = await getSecretKey();

    expect(mockedRequireLocalAuth).toHaveBeenCalledTimes(1);
    expect(secret).toBe("S" + "A".repeat(55));
  });

  it("never returns the secret when local auth fails or is cancelled", async () => {
    mockedRequireLocalAuth.mockRejectedValue(new LocalAuthRequiredError());

    await expect(getSecretKey()).rejects.toThrow(LocalAuthRequiredError);
  });
});
