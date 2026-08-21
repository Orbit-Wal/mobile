jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(async () => true),
  getStringAsync: jest.fn(async () => ""),
}));

import * as Clipboard from "expo-clipboard";
import { copyWithAutoClear } from "@/utils/clipboard";

describe("copyWithAutoClear", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (Clipboard.setStringAsync as jest.Mock).mockClear();
    (Clipboard.getStringAsync as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("copies the text immediately", async () => {
    await copyWithAutoClear("GPUBLICKEY", 45_000);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("GPUBLICKEY");
  });

  it("clears the clipboard after the timeout if it still holds the copied value", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue("GPUBLICKEY");
    await copyWithAutoClear("GPUBLICKEY", 1000);

    jest.advanceTimersByTime(1000);
    // Let the pending getStringAsync().then(...) microtask chain resolve.
    await Promise.resolve();
    await Promise.resolve();

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("");
  });

  it("does not clobber the clipboard if the user copied something else in the meantime", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue("SOMETHING_ELSE_THE_USER_COPIED");
    await copyWithAutoClear("GPUBLICKEY", 1000);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();

    expect(Clipboard.setStringAsync).not.toHaveBeenCalledWith("");
  });
});
