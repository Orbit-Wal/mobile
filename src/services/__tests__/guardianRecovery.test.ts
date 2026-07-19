import {
  MIN_GUARDIANS_FOR_RECOVERY,
  InvalidRecoveryConfigError,
  validateRecoveryConfig,
  buildRecoverAccountTx,
} from "@/services/guardianRecovery";
import * as StellarSdk from "@stellar/stellar-sdk";

describe("validateRecoveryConfig", () => {
  it("rejects fewer than the minimum guardian count", () => {
    expect(() => validateRecoveryConfig(MIN_GUARDIANS_FOR_RECOVERY - 1, 2)).toThrow(
      InvalidRecoveryConfigError
    );
  });

  it("rejects a threshold of 1 — a single guardian must never recover alone", () => {
    expect(() => validateRecoveryConfig(5, 1)).toThrow(InvalidRecoveryConfigError);
  });

  it("rejects a threshold of 0", () => {
    expect(() => validateRecoveryConfig(5, 0)).toThrow(InvalidRecoveryConfigError);
  });

  it("rejects a threshold greater than the guardian count", () => {
    expect(() => validateRecoveryConfig(3, 4)).toThrow(InvalidRecoveryConfigError);
  });

  it("accepts a valid M-of-N configuration", () => {
    expect(() => validateRecoveryConfig(MIN_GUARDIANS_FOR_RECOVERY, 2)).not.toThrow();
  });

  it("accepts threshold equal to guardian count (N-of-N)", () => {
    expect(() => validateRecoveryConfig(3, 3)).not.toThrow();
  });
});

describe("buildRecoverAccountTx", () => {
  it("rejects a non-positive delay", async () => {
    await expect(
      buildRecoverAccountTx({
        lostAccountPublicKey: StellarSdk.Keypair.random().publicKey(),
        newDevicePublicKey: StellarSdk.Keypair.random().publicKey(),
        delaySeconds: 0,
      })
    ).rejects.toThrow(InvalidRecoveryConfigError);
  });
});
