import * as Clipboard from "expo-clipboard";
import {
  clearClipboard,
  copyPublic,
  copySensitive,
  DEFAULT_PUBLIC_CLEAR_MS,
  DEFAULT_SENSITIVE_CLEAR_MS,
  looksLikeStellarSecret,
} from "./clipboard";

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(),
}));

const mockedSetString = Clipboard.setStringAsync as jest.Mock;

describe("clipboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("looksLikeStellarSecret", () => {
    it("detects a valid Stellar secret key format", () => {
      const valid = "S" + "A".repeat(55);
      expect(looksLikeStellarSecret(valid)).toBe(true);
    });

    it("rejects public keys and arbitrary text", () => {
      expect(looksLikeStellarSecret("GAAA1111111111111111111111111111111111111111111111AAAA")).toBe(false);
      expect(looksLikeStellarSecret("hello world")).toBe(false);
    });
  });

  describe("copyPublic", () => {
    it("copies public content and schedules an auto-clear", async () => {
      await copyPublic("GAAA1111111111111111111111111111111111111111111111AAAA");

      expect(mockedSetString).toHaveBeenCalledWith("GAAA1111111111111111111111111111111111111111111111AAAA");

      jest.advanceTimersByTime(DEFAULT_PUBLIC_CLEAR_MS);
      await Promise.resolve();

      expect(mockedSetString).toHaveBeenLastCalledWith("");
    });

    it("refuses secret material", async () => {
      const secret = "S" + "A".repeat(55);

      await expect(copyPublic(secret)).rejects.toThrow("copySensitive");
      expect(mockedSetString).not.toHaveBeenCalledWith(secret);
    });

    it("does not schedule a clear when disabled", async () => {
      await copyPublic("GAAA1111111111111111111111111111111111111111111111AAAA", 0);

      jest.advanceTimersByTime(DEFAULT_PUBLIC_CLEAR_MS);
      await Promise.resolve();

      expect(mockedSetString).toHaveBeenCalledTimes(1);
    });
  });

  describe("copySensitive", () => {
    it("copies and auto-clears after the shorter sensitive window", async () => {
      const secret = "S" + "A".repeat(55);
      await copySensitive(secret);

      expect(mockedSetString).toHaveBeenCalledWith(secret);

      jest.advanceTimersByTime(DEFAULT_SENSITIVE_CLEAR_MS);
      await Promise.resolve();

      expect(mockedSetString).toHaveBeenLastCalledWith("");
    });
  });

  describe("clearClipboard", () => {
    it("clears the clipboard immediately", async () => {
      await clearClipboard();
      expect(mockedSetString).toHaveBeenCalledWith("");
    });
  });
});
