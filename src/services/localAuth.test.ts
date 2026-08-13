import { Alert } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { LocalAuthRequiredError, requireLocalAuth } from "./localAuth";

jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
}));
jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

const mockedHasHardware = LocalAuthentication.hasHardwareAsync as jest.Mock;
const mockedIsEnrolled = LocalAuthentication.isEnrolledAsync as jest.Mock;
const mockedAuthenticate = LocalAuthentication.authenticateAsync as jest.Mock;
const mockedAlert = Alert.alert as jest.Mock;

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function pressAlertButton(label: string) {
  const call = mockedAlert.mock.calls.find((c) => c[2]?.some((b: { text: string }) => b.text === label));
  const button = call?.[2]?.find((b: { text: string }) => b.text === label);
  button?.onPress?.();
}

describe("requireLocalAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedHasHardware.mockResolvedValue(true);
    mockedIsEnrolled.mockResolvedValue(true);
    mockedAuthenticate.mockResolvedValue({ success: true });
  });

  it("returns true after a successful biometric prompt", async () => {
    await expect(requireLocalAuth("Unlock")).resolves.toBe(true);
    expect(mockedAuthenticate).toHaveBeenCalledWith(
      expect.objectContaining({ promptMessage: "Unlock", disableDeviceFallback: false })
    );
  });

  it("throws when the biometric prompt is cancelled or fails", async () => {
    mockedAuthenticate.mockResolvedValue({ success: false, error: "user_cancel" });

    await expect(requireLocalAuth()).rejects.toThrow(LocalAuthRequiredError);
  });

  it("falls back to an explicit warning when the device has no auth hardware", async () => {
    mockedHasHardware.mockResolvedValue(false);

    const promise = requireLocalAuth();
    await flush();
    pressAlertButton("Continue");

    await expect(promise).resolves.toBe(true);
    expect(mockedAuthenticate).not.toHaveBeenCalled();
  });

  it("throws when the user declines the no-hardware fallback", async () => {
    mockedHasHardware.mockResolvedValue(false);

    const promise = requireLocalAuth();
    await flush();
    pressAlertButton("Cancel");

    await expect(promise).rejects.toThrow(LocalAuthRequiredError);
  });

  it("falls back to an explicit warning when nothing is enrolled", async () => {
    mockedIsEnrolled.mockResolvedValue(false);

    const promise = requireLocalAuth();
    await flush();
    pressAlertButton("Continue");

    await expect(promise).resolves.toBe(true);
    expect(mockedAuthenticate).not.toHaveBeenCalled();
  });

  it("throws when the user declines the not-enrolled fallback", async () => {
    mockedIsEnrolled.mockResolvedValue(false);

    const promise = requireLocalAuth();
    await flush();
    pressAlertButton("Cancel");

    await expect(promise).rejects.toThrow(LocalAuthRequiredError);
  });
});
