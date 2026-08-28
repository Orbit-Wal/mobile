import * as StellarSdk from "@stellar/stellar-sdk";
import { parseSep7Uri, Sep7ParseError, Sep7PayRequest } from "@/services/sep7";

describe("parseSep7Uri", () => {
  const validDest = StellarSdk.Keypair.random().publicKey();
  const validIssuer = StellarSdk.Keypair.random().publicKey();

  it("parses a minimal pay request", () => {
    const result = parseSep7Uri(`web+stellar:pay?destination=${validDest}`) as Sep7PayRequest;
    expect(result.operation).toBe("pay");
    expect(result.destination).toBe(validDest);
    expect(result.originVerified).toBe(false);
  });

  it("parses amount, asset, and memo fields", () => {
    const result = parseSep7Uri(
      `web+stellar:pay?destination=${validDest}&amount=42.5&asset_code=USDC&asset_issuer=${validIssuer}&memo=hello&memo_type=MEMO_TEXT`
    ) as Sep7PayRequest;
    expect(result.amount).toBe("42.5");
    expect(result.assetCode).toBe("USDC");
    expect(result.assetIssuer).toBe(validIssuer);
    expect(result.memo).toBe("hello");
    expect(result.memoType).toBe("MEMO_TEXT");
  });

  it("rejects a non web+stellar: scheme", () => {
    expect(() => parseSep7Uri(`https://example.com/pay?destination=${validDest}`)).toThrow(Sep7ParseError);
  });

  it("rejects an unsupported operation", () => {
    expect(() => parseSep7Uri(`web+stellar:swap?destination=${validDest}`)).toThrow(Sep7ParseError);
  });

  it("rejects a pay request with no destination", () => {
    expect(() => parseSep7Uri("web+stellar:pay?amount=10")).toThrow(Sep7ParseError);
  });

  it("rejects an invalid destination", () => {
    expect(() => parseSep7Uri("web+stellar:pay?destination=not-an-address")).toThrow(Sep7ParseError);
  });

  it("rejects asset_code without asset_issuer", () => {
    expect(() => parseSep7Uri(`web+stellar:pay?destination=${validDest}&asset_code=USDC`)).toThrow(Sep7ParseError);
  });

  it("rejects an invalid amount", () => {
    expect(() => parseSep7Uri(`web+stellar:pay?destination=${validDest}&amount=-5`)).toThrow(Sep7ParseError);
    expect(() => parseSep7Uri(`web+stellar:pay?destination=${validDest}&amount=abc`)).toThrow(Sep7ParseError);
  });

  it("rejects a signature with no origin_domain", () => {
    expect(() => parseSep7Uri(`web+stellar:pay?destination=${validDest}&signature=abc`)).toThrow(Sep7ParseError);
  });

  it("rejects conflicting duplicate parameters", () => {
    expect(() =>
      parseSep7Uri(`web+stellar:pay?destination=${validDest}&destination=${validIssuer}`)
    ).toThrow(Sep7ParseError);
  });

  it("rejects an oversized payload", () => {
    const huge = `web+stellar:pay?destination=${validDest}&memo=` + "a".repeat(5000);
    expect(() => parseSep7Uri(huge)).toThrow(Sep7ParseError);
  });

  it("rejects non-ASCII payloads", () => {
    expect(() => parseSep7Uri(`web+stellar:pay?destination=${validDest}&msg=hé`)).toThrow(Sep7ParseError);
  });

  it("rejects empty input", () => {
    expect(() => parseSep7Uri("")).toThrow(Sep7ParseError);
  });

  it("parses a tx request with a valid XDR envelope", () => {
    const account = new StellarSdk.Account(validDest, "0");
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(StellarSdk.Operation.payment({ destination: validIssuer, asset: StellarSdk.Asset.native(), amount: "1" }))
      .setTimeout(30)
      .build();
    const xdr = encodeURIComponent(tx.toEnvelope().toXDR("base64"));
    const result = parseSep7Uri(`web+stellar:tx?xdr=${xdr}`);
    expect(result.operation).toBe("tx");
  });

  it("rejects a tx request with a malformed XDR", () => {
    expect(() => parseSep7Uri("web+stellar:tx?xdr=not-valid-xdr")).toThrow(Sep7ParseError);
  });

  it("rejects a tx request with no xdr", () => {
    expect(() => parseSep7Uri("web+stellar:tx?callback=url:https://example.com")).toThrow(Sep7ParseError);
  });
});
