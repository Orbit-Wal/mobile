jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    Horizon: {
      Server: jest.fn().mockReturnValue({
        loadAccount: jest.fn(),
        submitTransaction: jest.fn(),
      }),
    },
  };
});

import { getAccount, getBalances, sendPayment } from "@/services/stellar";
import * as StellarSdk from "@stellar/stellar-sdk";

const MockServer = StellarSdk.Horizon.Server as jest.Mock;

let loadAccountMock: jest.Mock;
let submitTransactionMock: jest.Mock;
let serverTimeout: number;

beforeAll(() => {
  const instance = MockServer.mock.results[0].value;
  loadAccountMock = instance.loadAccount;
  submitTransactionMock = instance.submitTransaction;
  const [, opts] = MockServer.mock.calls[0];
  serverTimeout = opts.timeout;
});

beforeEach(() => {
  jest.resetAllMocks();
});

function mockAccount(key: string, sequence = "100") {
  return new StellarSdk.Account(key, sequence);
}

function mockBalances(key: string, balances: Array<Record<string, string>>) {
  const acc = mockAccount(key);
  Object.assign(acc, { balances });
  return acc as any;
}

describe("Horizon timeout configuration", () => {
  it("passes a timeout to the Server constructor", () => {
    expect(serverTimeout).toEqual(expect.any(Number));
  });
});

describe("getAccount", () => {
  const key = StellarSdk.Keypair.random().publicKey();

  it("retries on transient failure and succeeds", async () => {
    const acc = mockAccount(key);

    loadAccountMock
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(acc);

    const result = await getAccount(key);

    expect(loadAccountMock).toHaveBeenCalledTimes(3);
    expect(result).toBe(acc);
  });

  it("throws after exhausting retries", async () => {
    loadAccountMock.mockRejectedValue(new Error("persistent error"));

    await expect(getAccount(key)).rejects.toThrow("persistent error");

    expect(loadAccountMock).toHaveBeenCalledTimes(4);
  });
});

describe("getBalances", () => {
  const key = StellarSdk.Keypair.random().publicKey();

  it("retries via getAccount on underlying failure", async () => {
    loadAccountMock
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(
        mockBalances(key, [{ asset_type: "native", balance: "100.0000000" }]),
      );

    const result = await getBalances(key);

    expect(loadAccountMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ XLM: "100.0000000" });
  });

  it("parses native and non-native balances", async () => {
    loadAccountMock.mockResolvedValue(
      mockBalances(key, [
        { asset_type: "native", balance: "500.0000000" },
        { asset_code: "USDC", asset_type: "credit_alphanum4", balance: "200.0000000" },
        { asset_code: "ETH", asset_type: "credit_alphanum4", balance: "1.5000000" },
      ]),
    );

    const result = await getBalances(key);

    expect(result).toEqual({ XLM: "500.0000000", USDC: "200.0000000", ETH: "1.5000000" });
  });
});

describe("sendPayment", () => {
  it("retries getAccount (idempotent read) but not submitTransaction", async () => {
    const keypair = StellarSdk.Keypair.random();
    const destKeypair = StellarSdk.Keypair.random();

    loadAccountMock
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(mockAccount(keypair.publicKey()));
    submitTransactionMock.mockRejectedValue(new Error("submission failed"));

    await expect(
      sendPayment({
        sourceSecretKey: keypair.secret(),
        destinationPublicKey: destKeypair.publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: "10",
      }),
    ).rejects.toThrow("submission failed");

    expect(loadAccountMock).toHaveBeenCalledTimes(2);
    expect(submitTransactionMock).toHaveBeenCalledTimes(1);
  });

  it("happy path — returns submission result", async () => {
    const keypair = StellarSdk.Keypair.random();

    loadAccountMock.mockResolvedValue(mockAccount(keypair.publicKey()));
    submitTransactionMock.mockResolvedValue({ hash: "abc", ledger: 1 });

    const result = await sendPayment({
      sourceSecretKey: keypair.secret(),
      destinationPublicKey: StellarSdk.Keypair.random().publicKey(),
      asset: StellarSdk.Asset.native(),
      amount: "10",
    });

    expect(result).toEqual({ hash: "abc", ledger: 1 });
    expect(submitTransactionMock).toHaveBeenCalledTimes(1);
  });
});
