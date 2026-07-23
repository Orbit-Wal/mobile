import { Alert, Platform } from "react-native";
import {
  addScreenshotListener,
  allowScreenCaptureAsync,
  preventScreenCaptureAsync,
} from "expo-screen-capture";
import { useEffect } from "react";
import { useScreenCaptureProtection } from "./useScreenCaptureProtection";

jest.mock("react", () => ({ useEffect: jest.fn() }));
jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: "android" },
}));
jest.mock("expo-screen-capture", () => ({
  addScreenshotListener: jest.fn(),
  allowScreenCaptureAsync: jest.fn(),
  preventScreenCaptureAsync: jest.fn(),
}));

const mockedUseEffect = useEffect as jest.Mock;
const mockedPreventScreenCapture = preventScreenCaptureAsync as jest.Mock;
const mockedAllowScreenCapture = allowScreenCaptureAsync as jest.Mock;
const mockedAddScreenshotListener = addScreenshotListener as jest.Mock;

describe("useScreenCaptureProtection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
  });

  it("enables Android screen-capture prevention and removes it on cleanup", () => {
    useScreenCaptureProtection();

    const effect = mockedUseEffect.mock.calls[0][0] as () => () => void;
    const cleanup = effect();

    expect(mockedPreventScreenCapture).toHaveBeenCalledTimes(1);
    expect(mockedAddScreenshotListener).not.toHaveBeenCalled();

    cleanup();

    expect(mockedAllowScreenCapture).toHaveBeenCalledTimes(1);
  });

  it("warns after an iOS screenshot is detected", () => {
    const subscription = { remove: jest.fn() };
    let onScreenshot: (() => void) | undefined;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
    mockedAddScreenshotListener.mockImplementation((listener: () => void) => {
      onScreenshot = listener;
      return subscription;
    });

    useScreenCaptureProtection();

    const effect = mockedUseEffect.mock.calls[0][0] as () => () => void;
    const cleanup = effect();
    onScreenshot?.();

    expect(Alert.alert).toHaveBeenCalledWith(
      "Screenshot Detected",
      expect.stringContaining("sensitive wallet information")
    );

    cleanup();

    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });
});
