import * as Clipboard from "expo-clipboard";

export const DEFAULT_PUBLIC_CLEAR_MS = 30_000;
export const DEFAULT_SENSITIVE_CLEAR_MS = 10_000;
export const STELLAR_SECRET_RE = /^S[1-9A-HJ-NP-Z]{55}$/;

export function looksLikeStellarSecret(text: string): boolean {
  return STELLAR_SECRET_RE.test(text.trim());
}

export async function clearClipboard(): Promise<void> {
  await Clipboard.setStringAsync("");
}

export async function copyPublic(
  text: string,
  clearAfterMs = DEFAULT_PUBLIC_CLEAR_MS
): Promise<void> {
  if (looksLikeStellarSecret(text)) {
    throw new Error(
      "Refusing to copy secret material via copyPublic(). Use copySensitive() for secrets."
    );
  }
  await Clipboard.setStringAsync(text);
  if (clearAfterMs > 0) {
    setTimeout(() => {
      void Clipboard.setStringAsync("");
    }, clearAfterMs);
  }
}

export async function copySensitive(
  text: string,
  clearAfterMs = DEFAULT_SENSITIVE_CLEAR_MS
): Promise<void> {
  await Clipboard.setStringAsync(text);
  if (clearAfterMs > 0) {
    setTimeout(() => {
      void Clipboard.setStringAsync("");
    }, clearAfterMs);
  }
}
