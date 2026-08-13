import { Platform } from "react-native";
import * as Device from "expo-device";
import * as LocalAuthentication from "expo-local-authentication";
import { assessSecretStorageTier } from "../keychainParity";

jest.mock("react-native", () => {
  const state = { OS: "android" };
  return {
    Platform: {
      get OS() { return state.OS; },
      __setOS(value: string) { state.OS = value; },
    },
  };
});
jest.mock("expo-device", () => {
  const state = { isDevice: true };
  return {
    get isDevice() { return state.isDevice; },
    isRootedExperimentalAsync: jest.fn(async () => false),
    __setIsDevice(value: boolean) { state.isDevice = value; },
  };
});
jest.mock("expo-local-authentication", () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC: 2 },
  getEnrolledLevelAsync: jest.fn(async () => 0),
}));

const mockedIsRooted = Device.isRootedExperimentalAsync as jest.Mock;
const mockedGetEnrolled = LocalAuthentication.getEnrolledLevelAsync as jest.Mock;
const setOS = (Platform as unknown as { __setOS: (v: string) => void }).__setOS;
const setIsDevice = (Device as unknown as { __setIsDevice: (v: boolean) => void }).__setIsDevice;

describe("assessSecretStorageTier", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setOS("android");
    setIsDevice(true);
    mockedIsRooted.mockResolvedValue(false);
    mockedGetEnrolled.mockResolvedValue(LocalAuthentication.SecurityLevel.BIOMETRIC);
  });

  it("rates Android with class-3 biometric strong", async () => {
    const assessment = await assessSecretStorageTier();
    expect(assessment.tier).toBe("strong");
  });

  it("rates Android PIN-only weak", async () => {
    mockedGetEnrolled.mockResolvedValue(LocalAuthentication.SecurityLevel.SECRET);
    const assessment = await assessSecretStorageTier();
    expect(assessment.tier).toBe("weak");
  });

  it("rates Android with nothing enrolled weak", async () => {
    mockedGetEnrolled.mockResolvedValue(LocalAuthentication.SecurityLevel.NONE);
    const assessment = await assessSecretStorageTier();
    expect(assessment.tier).toBe("weak");
  });

  it("rates Android emulator weak regardless of enrollment", async () => {
    setIsDevice(false);
    const assessment = await assessSecretStorageTier();
    expect(assessment.tier).toBe("weak");
    expect(assessment.reasons.join(" ")).toMatch(/emulator/i);
  });

  it("rates any rooted device weak regardless of platform", async () => {
    mockedIsRooted.mockResolvedValue(true);
    const android = await assessSecretStorageTier();
    expect(android.tier).toBe("weak");

    setOS("ios");
    const ios = await assessSecretStorageTier();
    expect(ios.tier).toBe("weak");
  });

  it("rates non-rooted iOS strong", async () => {
    setOS("ios");
    const assessment = await assessSecretStorageTier();
    expect(assessment.tier).toBe("strong");
  });

  it("does not throw when the root check fails", async () => {
    mockedIsRooted.mockRejectedValue(new Error("no device api"));
    const assessment = await assessSecretStorageTier();
    expect(assessment.isRooted).toBe(false);
    expect(["strong", "weak", "unknown"]).toContain(assessment.tier);
  });
});
