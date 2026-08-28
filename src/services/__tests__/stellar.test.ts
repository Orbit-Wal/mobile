import * as StellarSdk from "@stellar/stellar-sdk";
import { checkMemoRequired } from "@/services/stellar";

// SEP-29 memo-required check (#24). Mocks Horizon's loadAccount at the
// prototype level -- the module-level `server` instance in src/services/stellar.ts
// still resolves methods through the prototype, so this affects it without
// needing to mock the whole module.
describe("checkMemoRequired", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns true for a known memo-required destination pattern (config.memo_required data entry present)", async () => {
    jest.spyOn(StellarSdk.Horizon.Server.prototype, "loadAccount").mockResolvedValue({
      data_attr: { "config.memo_required": "MQ==" },
    } as unknown as StellarSdk.Horizon.AccountResponse);

    const dest = StellarSdk.Keypair.random().publicKey();
    await expect(checkMemoRequired(dest)).resolves.toBe(true);
  });

  it("returns false when the destination has no config.memo_required data entry", async () => {
    jest.spyOn(StellarSdk.Horizon.Server.prototype, "loadAccount").mockResolvedValue({
      data_attr: {},
    } as unknown as StellarSdk.Horizon.AccountResponse);

    const dest = StellarSdk.Keypair.random().publicKey();
    await expect(checkMemoRequired(dest)).resolves.toBe(false);
  });

  it("returns false (not true) for an unfunded destination rather than throwing", async () => {
    jest
      .spyOn(StellarSdk.Horizon.Server.prototype, "loadAccount")
      .mockRejectedValue(new StellarSdk.NotFoundError("Account not found", {}));

    const dest = StellarSdk.Keypair.random().publicKey();
    await expect(checkMemoRequired(dest)).resolves.toBe(false);
  });
});
