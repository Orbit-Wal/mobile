import * as StellarSdk from "@stellar/stellar-sdk";

const HORIZON_URL = process.env.EXPO_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.EXPO_PUBLIC_NETWORK_PASSPHRASE ?? StellarSdk.Networks.TESTNET;

const server = new StellarSdk.Horizon.Server(HORIZON_URL);

export type StellarServiceErrorCode =
  | "INVALID_PUBLIC_KEY"
  | "ACCOUNT_NOT_FOUND"
  | "NETWORK_ERROR"
  | "ENTROPY_UNAVAILABLE"
  | "NO_PATH_FOUND";

/**
 * Wraps every failure mode getAccount/getBalances can hit in one typed error
 * so callers (UI code) can show a specific message instead of a generic
 * "something went wrong" -- an unfunded testnet account (404, expected and
 * recoverable by funding it) looks nothing like a malformed address or a
 * dropped connection, and shouldn't be presented the same way.
 */
export class StellarServiceError extends Error {
  code: StellarServiceErrorCode;

  constructor(message: string, code: StellarServiceErrorCode) {
    super(message);
    this.name = "StellarServiceError";
    this.code = code;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 300;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new StellarServiceError(`${label} timed out after ${timeoutMs}ms.`, "NETWORK_ERROR"));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Retries only NETWORK_ERROR-classified failures (timeouts, dropped
 * connections, 5xx) with exponential backoff. INVALID_PUBLIC_KEY and
 * ACCOUNT_NOT_FOUND are deliberately not retried -- the answer won't change
 * without user action, so retrying would just add latency.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = DEFAULT_RETRIES): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isRetryable = err instanceof StellarServiceError ? err.code === "NETWORK_ERROR" : true;
      if (!isRetryable || attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * 2 ** attempt));
    }
  }
  throw lastErr;
}

/**
 * @stellar/stellar-sdk generates keys via tweetnacl, which requires
 * `crypto.getRandomValues` to be present *before* it's first imported --
 * see index.js, which loads the react-native-get-random-values polyfill
 * ahead of expo-router/entry for exactly this reason. If that polyfill is
 * ever removed, or a future refactor imports stellar.ts from a module
 * evaluated before the polyfill runs, tweetnacl silently and permanently
 * disables its PRNG and Keypair.random() starts throwing "no PRNG" --
 * this check turns that into an explicit, diagnosable error instead.
 */
function assertSecureRandomAvailable(): void {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
    throw new StellarServiceError(
      "Secure random number generation is unavailable on this device " +
        "(crypto.getRandomValues is missing). Wallet creation cannot proceed " +
        "safely. This should never happen in a build that loads index.js's " +
        "react-native-get-random-values polyfill before expo-router/entry.",
      "ENTROPY_UNAVAILABLE"
    );
  }
}

export function generateKeypair(): StellarSdk.Keypair {
  assertSecureRandomAvailable();
  return StellarSdk.Keypair.random();
}

export async function getAccount(publicKey: string) {
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(publicKey)) {
    throw new StellarServiceError(
      `"${publicKey}" is not a valid Stellar public key.`,
      "INVALID_PUBLIC_KEY"
    );
  }

  return withRetry(async () => {
    try {
      return await withTimeout(server.loadAccount(publicKey), DEFAULT_TIMEOUT_MS, "loadAccount");
    } catch (err) {
      if (err instanceof StellarSdk.NotFoundError) {
        throw new StellarServiceError(
          "This account has not been funded on the network yet.",
          "ACCOUNT_NOT_FOUND"
        );
      }
      if (err instanceof StellarServiceError) throw err;
      throw new StellarServiceError(
        "Could not reach the Stellar network. Check your connection and try again.",
        "NETWORK_ERROR"
      );
    }
  });
}

export async function getBalances(publicKey: string): Promise<Record<string, string>> {
  const account = await getAccount(publicKey);
  const result: Record<string, string> = {};
  for (const balance of account.balances) {
    if (balance.asset_type === "native") {
      result["XLM"] = balance.balance;
    } else if ("asset_code" in balance) {
      result[balance.asset_code] = balance.balance;
    }
  }
  return result;
}

export async function sendPayment(params: {
  sourceSecretKey: string;
  destinationPublicKey: string;
  asset: StellarSdk.Asset;
  amount: string;
  memo?: string;
}): Promise<StellarSdk.Horizon.HorizonApi.SubmitTransactionResponse> {
  // Note on key material lifetime (issue #37): sourceSecretKey and
  // sourceKeypair are ordinary JS values here. JS strings are immutable and
  // GC timing isn't controllable from userland, so there is no way to
  // force-wipe them from memory the instant signing finishes -- this
  // function just avoids holding extra copies or logging them, which is
  // the practical ceiling for zeroization in a JS/Hermes runtime.
  const { sourceSecretKey, destinationPublicKey, asset, amount, memo } = params;
  const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey);
  const sourceAccount = await getAccount(sourceKeypair.publicKey());

  // BASE_FEE (100 stroops) is the network minimum, not a real fee estimate --
  // it's routinely insufficient during surge pricing, when transactions with
  // only the base fee get starved out of the ledger. fetchBaseFee() asks
  // Horizon for the fee actually required by recent ledger congestion; if
  // that call fails for any reason we still fall back to BASE_FEE so a
  // Horizon fee-stats outage doesn't block sending entirely.
  let fee: string = StellarSdk.BASE_FEE;
  try {
    fee = String(await server.fetchBaseFee());
  } catch {
    // Fall back to BASE_FEE.
  }

  const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationPublicKey,
        asset,
        amount,
      })
    )
    .setTimeout(30);
  if (memo) builder.addMemo(StellarSdk.Memo.text(memo));
  const tx = builder.build();
  tx.sign(sourceKeypair);
  // Deliberately no retry here, unlike getAccount: if submitTransaction's
  // response is lost after Horizon already applied the transaction, blindly
  // retrying could double-submit. A timeout still applies so a hung request
  // doesn't leave the caller waiting forever, but the caller is responsible
  // for checking transaction status before deciding to resubmit.
  return withTimeout(server.submitTransaction(tx), DEFAULT_TIMEOUT_MS, "submitTransaction");
}

// --- SEP-29: memo-required destinations (issue #24) ---------------------

/**
 * SEP-29 (https://stellar.org/protocol/sep-29) has exchanges/custodians
 * mark deposit accounts with an account "data entry" whose key is exactly
 * `config.memo_required`. This checks for the *presence* of that key --
 * not its decoded value -- because that's the convention real-world
 * destinations (and other wallets checking for it) actually follow, and
 * because failing to warn a user about to send to a memo-required address
 * is a far worse failure mode than an occasional over-cautious warning.
 */
export async function checkMemoRequired(destinationPublicKey: string): Promise<boolean> {
  try {
    const account = await getAccount(destinationPublicKey);
    const dataAttr = (account as unknown as { data_attr?: Record<string, string> }).data_attr ?? {};
    return Object.prototype.hasOwnProperty.call(dataAttr, "config.memo_required");
  } catch (err) {
    if (err instanceof StellarServiceError && err.code === "ACCOUNT_NOT_FOUND") {
      // An unfunded account can't carry data entries -- nothing to warn about.
      return false;
    }
    throw err;
  }
}

// --- Path payments (issue #25) -------------------------------------------

/** Never allow an unbounded destMin (0) or sendMax (infinite) -- slippage is
 * always applied, and this is the widest tolerance a caller can request even
 * if they pass something larger. */
const MAX_SLIPPAGE_BPS = 5000; // 50%
export const DEFAULT_SLIPPAGE_BPS = 100; // 1%

function clampSlippageBps(bps: number): number {
  if (!Number.isFinite(bps) || bps < 0) return DEFAULT_SLIPPAGE_BPS;
  return Math.min(bps, MAX_SLIPPAGE_BPS);
}

/**
 * Applies a slippage tolerance to an expected counter-asset amount to derive
 * a `destMin` (strict-send) or `sendMax` (strict-receive) bound.
 *
 * Uses plain floating point rather than a fixed-point/BigNumber library --
 * Stellar amounts cap at 7 decimal places, so we round outward (floor for a
 * minimum, ceil for a maximum) to that precision, which is close enough for
 * a slippage *tolerance* (as opposed to the exact amount itself, which is
 * always taken from the user-entered string, never recomputed here).
 */
function applySlippage(expectedAmount: string, slippageBps: number, direction: "min" | "max"): string {
  const bounded = clampSlippageBps(slippageBps);
  const value = parseFloat(expectedAmount);
  const factor = direction === "min" ? 1 - bounded / 10_000 : 1 + bounded / 10_000;
  const raw = value * factor;
  const scaled = direction === "min" ? Math.floor(raw * 1e7) : Math.ceil(raw * 1e7);
  const bound = Math.max(scaled, direction === "min" ? 0 : 1) / 1e7;
  return bound.toFixed(7);
}

/**
 * Finds strict-send payment paths (fixed source amount, variable
 * destination amount) via Horizon's path-finding endpoint. Throws a
 * NO_PATH_FOUND error -- rather than returning an empty array -- so callers
 * surface "no route exists" distinctly from a generic transaction failure,
 * per issue #25's DoD.
 */
export async function findStrictSendPaths(params: {
  sendAsset: StellarSdk.Asset;
  sendAmount: string;
  destinationPublicKey: string;
}): Promise<StellarSdk.Horizon.ServerApi.PaymentPathRecord[]> {
  const { sendAsset, sendAmount, destinationPublicKey } = params;
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(destinationPublicKey)) {
    throw new StellarServiceError(
      `"${destinationPublicKey}" is not a valid Stellar public key.`,
      "INVALID_PUBLIC_KEY"
    );
  }
  return withRetry(async () => {
    let response;
    try {
      response = await withTimeout(
        server.strictSendPaths(sendAsset, sendAmount, destinationPublicKey).call(),
        DEFAULT_TIMEOUT_MS,
        "strictSendPaths"
      );
    } catch (err) {
      if (err instanceof StellarServiceError) throw err;
      throw new StellarServiceError(
        "Could not reach the Stellar network to find a payment path. Check your connection and try again.",
        "NETWORK_ERROR"
      );
    }
    if (response.records.length === 0) {
      throw new StellarServiceError(
        "No payment path was found between these assets right now. Try a smaller amount or a different asset.",
        "NO_PATH_FOUND"
      );
    }
    return response.records;
  });
}

/**
 * Finds strict-receive payment paths (fixed destination amount, variable
 * source amount). See findStrictSendPaths for the NO_PATH_FOUND rationale.
 */
export async function findStrictReceivePaths(params: {
  sourcePublicKey: string;
  destAsset: StellarSdk.Asset;
  destAmount: string;
}): Promise<StellarSdk.Horizon.ServerApi.PaymentPathRecord[]> {
  const { sourcePublicKey, destAsset, destAmount } = params;
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(sourcePublicKey)) {
    throw new StellarServiceError(
      `"${sourcePublicKey}" is not a valid Stellar public key.`,
      "INVALID_PUBLIC_KEY"
    );
  }
  return withRetry(async () => {
    let response;
    try {
      response = await withTimeout(
        server.strictReceivePaths(sourcePublicKey, destAsset, destAmount).call(),
        DEFAULT_TIMEOUT_MS,
        "strictReceivePaths"
      );
    } catch (err) {
      if (err instanceof StellarServiceError) throw err;
      throw new StellarServiceError(
        "Could not reach the Stellar network to find a payment path. Check your connection and try again.",
        "NETWORK_ERROR"
      );
    }
    if (response.records.length === 0) {
      throw new StellarServiceError(
        "No payment path was found between these assets right now. Try a smaller amount or a different asset.",
        "NO_PATH_FOUND"
      );
    }
    return response.records;
  });
}

/**
 * Submits a path payment (cross-asset send). `expectedCounterAmount` should
 * come straight from the path-finding record the caller quoted (destination_amount
 * for strict-send, source_amount for strict-receive) -- slippageBps is then
 * applied on top of that quote to derive destMin/sendMax, so the bound is
 * always relative to a real quote and never unbounded (see applySlippage).
 */
export async function sendPathPayment(params: {
  sourceSecretKey: string;
  destinationPublicKey: string;
  sendAsset: StellarSdk.Asset;
  destAsset: StellarSdk.Asset;
  mode: "strictSend" | "strictReceive";
  amount: string;
  expectedCounterAmount: string;
  path?: StellarSdk.Asset[];
  slippageBps?: number;
  memo?: string;
}): Promise<StellarSdk.Horizon.HorizonApi.SubmitTransactionResponse> {
  const {
    sourceSecretKey,
    destinationPublicKey,
    sendAsset,
    destAsset,
    mode,
    amount,
    expectedCounterAmount,
    path = [],
    slippageBps = DEFAULT_SLIPPAGE_BPS,
    memo,
  } = params;

  const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey);
  const sourceAccount = await getAccount(sourceKeypair.publicKey());

  let fee: string = StellarSdk.BASE_FEE;
  try {
    fee = String(await server.fetchBaseFee());
  } catch {
    // Fall back to BASE_FEE.
  }

  const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (mode === "strictSend") {
    const destMin = applySlippage(expectedCounterAmount, slippageBps, "min");
    builder.addOperation(
      StellarSdk.Operation.pathPaymentStrictSend({
        sendAsset,
        sendAmount: amount,
        destination: destinationPublicKey,
        destAsset,
        destMin,
        path,
      })
    );
  } else {
    const sendMax = applySlippage(expectedCounterAmount, slippageBps, "max");
    builder.addOperation(
      StellarSdk.Operation.pathPaymentStrictReceive({
        sendAsset,
        sendMax,
        destination: destinationPublicKey,
        destAsset,
        destAmount: amount,
        path,
      })
    );
  }

  builder.setTimeout(30);
  if (memo) builder.addMemo(StellarSdk.Memo.text(memo));
  const tx = builder.build();
  tx.sign(sourceKeypair);
  // Same no-retry rationale as sendPayment above.
  return withTimeout(server.submitTransaction(tx), DEFAULT_TIMEOUT_MS, "submitTransaction");
}
