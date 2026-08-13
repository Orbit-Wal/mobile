export const CANONICAL_HOST = "links.globewallet.example";

export const FUNDS_MOVING_ACTIONS: ReadonlySet<string> = new Set(["pay", "send"]);

export class UnsafeDeepLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeDeepLinkError";
  }
}

export function isVerifiedDeepLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === CANONICAL_HOST;
  } catch {
    return false;
  }
}

export function isFundsMovingAction(action: string): boolean {
  return FUNDS_MOVING_ACTIONS.has(action);
}

export function assertSafeDeepLink(url: string, action: string): void {
  if (isFundsMovingAction(action) && !isVerifiedDeepLink(url)) {
    throw new UnsafeDeepLinkError(
      `Refusing ${action} via an unverified deep link. Only https://${CANONICAL_HOST} links may move funds.`
    );
  }
}
