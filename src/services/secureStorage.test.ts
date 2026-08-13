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
jest.mock("./keychainParity", () => ({
  assessSecretStorageTier: jest.fn(),
}));

import { Alert } from "react-native";
import { saveSecretKey } from "./secureStorage";
import { assessSecretStorageTier, SecretStorageAssessment } from "./keychainParity";
import * as SecureStore from "expo-secure-store";

const mockedAssess = assessSecretStorageTier as jest.Mock;
const mockedAlert = Alert.alert as jest.Mock;

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function pressAlertButton(label: string) {
  const call = mockedAlert.mock.calls.find((c) => c[2]?.some((b: { text: string }) => b.text === label));
  const button = call?.[2]?.find((b: { text: string }) => b.text === label);
  button?.onPress?.();
}

function baseAssessment(overrides: Partial<SecretStorageAssessment>): SecretStorageAssessment {
  return {
    tier: "strong",
    platform: "android",
    isPhysicalDevice: true,
    securityLevel: 2,
    isRooted: false,
    reasons: [],
    ...overrides,
  };
}

describe("saveSecretKey storage-tier warning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAssess.mockResolvedValue(baseAssessment({}));
  });

  it("stores without warning on a strong tier", async () => {
    await saveSecretKey("S" + "A".repeat(55));

    expect(mockedAlert).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it("warns but still stores on a weak tier", async () => {
    mockedAssess.mockResolvedValue(baseAssessment({ tier: "weak", reasons: ["Emulator detected."] }));

    const promise = saveSecretKey("S" + "A".repeat(55));
    await flush();
    pressAlertButton("I Understand");
    await promise;

    expect(mockedAlert).toHaveBeenCalledWith(
      "Weak secure storage detected",
      expect.stringContaining("Emulator detected."),
      expect.anything(),
      expect.anything()
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });
});
