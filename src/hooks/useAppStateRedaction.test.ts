import { useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAppStateRedaction } from "./useAppStateRedaction";

jest.mock("react", () => ({
  useEffect: jest.fn(),
  useState: jest.fn(),
}));
jest.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: jest.fn(),
  },
}));

const mockedUseState = useState as jest.Mock;
const mockedUseEffect = useEffect as jest.Mock;
const mockedAddEventListener = AppState.addEventListener as jest.Mock;

describe("useAppStateRedaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(AppState, "currentState", {
      configurable: true,
      value: "active",
    });
    mockedUseState.mockImplementation((initial: boolean) => [initial, jest.fn()]);
  });

  it("derives the initial redacted state from AppState.currentState", () => {
    Object.defineProperty(AppState, "currentState", {
      configurable: true,
      value: "background",
    });

    useAppStateRedaction();

    expect(mockedUseState).toHaveBeenCalledWith(true);
  });

  it("does not redact on launch while the app is active", () => {
    useAppStateRedaction();

    expect(mockedUseState).toHaveBeenCalledWith(false);
  });

  it("redacts when the app transitions to background", () => {
    const setRedacted = jest.fn();
    mockedUseState.mockImplementation(() => [false, setRedacted]);
    let onStateChange: ((state: AppStateStatus) => void) | undefined;
    mockedAddEventListener.mockImplementation(
      (_: string, handler: (state: AppStateStatus) => void) => {
        onStateChange = handler;
        return { remove: jest.fn() };
      }
    );

    useAppStateRedaction();

    const effect = mockedUseEffect.mock.calls[0][0] as () => () => void;
    effect();
    onStateChange?.("background");

    expect(setRedacted).toHaveBeenCalledWith(true);
  });

  it("redacts on inactive so the iOS app-switcher snapshot is covered", () => {
    const setRedacted = jest.fn();
    mockedUseState.mockImplementation(() => [false, setRedacted]);
    let onStateChange: ((state: AppStateStatus) => void) | undefined;
    mockedAddEventListener.mockImplementation(
      (_: string, handler: (state: AppStateStatus) => void) => {
        onStateChange = handler;
        return { remove: jest.fn() };
      }
    );

    useAppStateRedaction();

    const effect = mockedUseEffect.mock.calls[0][0] as () => () => void;
    effect();
    onStateChange?.("inactive");

    expect(setRedacted).toHaveBeenCalledWith(true);
  });

  it("unredacts when the app returns to active", () => {
    const setRedacted = jest.fn();
    mockedUseState.mockImplementation(() => [true, setRedacted]);
    let onStateChange: ((state: AppStateStatus) => void) | undefined;
    mockedAddEventListener.mockImplementation(
      (_: string, handler: (state: AppStateStatus) => void) => {
        onStateChange = handler;
        return { remove: jest.fn() };
      }
    );

    useAppStateRedaction();

    const effect = mockedUseEffect.mock.calls[0][0] as () => () => void;
    effect();
    onStateChange?.("active");

    expect(setRedacted).toHaveBeenCalledWith(false);
  });

  it("removes the AppState listener on cleanup", () => {
    const remove = jest.fn();
    mockedAddEventListener.mockReturnValue({ remove });

    useAppStateRedaction();

    const effect = mockedUseEffect.mock.calls[0][0] as () => () => void;
    const cleanup = effect();
    cleanup();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
