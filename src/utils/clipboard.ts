import * as Clipboard from "expo-clipboard";

const DEFAULT_CLEAR_AFTER_MS = 45_000;

/**
 * Copies `text` to the clipboard and schedules it to be cleared after
 * `clearAfterMs`. Only clears if the clipboard still holds exactly what we
 * put there, so we never clobber something the user copied afterward.
 */
export async function copyWithAutoClear(
  text: string,
  clearAfterMs: number = DEFAULT_CLEAR_AFTER_MS
): Promise<void> {
  await Clipboard.setStringAsync(text);

  setTimeout(() => {
    Clipboard.getStringAsync()
      .then((current) => {
        if (current === text) {
          return Clipboard.setStringAsync("");
        }
        return undefined;
      })
      .catch(() => {
        // Best-effort: if the clipboard can't be read/cleared (e.g. the app
        // is backgrounded and loses permission on some platforms), there's
        // nothing actionable to do here.
      });
  }, clearAfterMs);
}
