import {
  assertSafeDeepLink,
  CANONICAL_HOST,
  isFundsMovingAction,
  isVerifiedDeepLink,
  UnsafeDeepLinkError,
} from "../deepLinks";

describe("deepLinks", () => {
  describe("isVerifiedDeepLink", () => {
    it("accepts https links on the canonical host", () => {
      expect(isVerifiedDeepLink(`https://${CANONICAL_HOST}/pay?to=GAAA...&amount=1`)).toBe(true);
    });

    it("rejects the claimable custom scheme", () => {
      expect(isVerifiedDeepLink("globewallet://pay?to=GAAA...&amount=1")).toBe(false);
    });

    it("rejects http and foreign hosts", () => {
      expect(isVerifiedDeepLink(`http://${CANONICAL_HOST}/pay`)).toBe(false);
      expect(isVerifiedDeepLink("https://evil.example/pay")).toBe(false);
    });

    it("rejects garbage input", () => {
      expect(isVerifiedDeepLink("not a url")).toBe(false);
    });
  });

  describe("isFundsMovingAction", () => {
    it("flags pay and send", () => {
      expect(isFundsMovingAction("pay")).toBe(true);
      expect(isFundsMovingAction("send")).toBe(true);
    });

    it("does not flag navigation-only actions", () => {
      expect(isFundsMovingAction("chat")).toBe(false);
    });
  });

  describe("assertSafeDeepLink", () => {
    it("blocks a spoofed custom-scheme link from triggering a payment", () => {
      expect(() => assertSafeDeepLink("globewallet://pay?to=GAAA...&amount=1", "pay")).toThrow(
        UnsafeDeepLinkError
      );
    });

    it("allows a verified https link to trigger a payment", () => {
      expect(() =>
        assertSafeDeepLink(`https://${CANONICAL_HOST}/pay?to=GAAA...&amount=1`, "pay")
      ).not.toThrow();
    });

    it("allows unverified links for non-funds-moving navigation", () => {
      expect(() => assertSafeDeepLink("globewallet://guardians", "guardians")).not.toThrow();
    });
  });
});
