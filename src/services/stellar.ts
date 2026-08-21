import * as StellarSdk from "@stellar/stellar-sdk";

const HORIZON_URL = process.env.EXPO_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.EXPO_PUBLIC_NETWORK_PASSPHRASE ?? StellarSdk.Networks.TESTNET;

const server = new StellarSdk.Horizon.Server(HORIZON_URL);

export type StellarServiceErrorCode =
  | "INVALID_PUBLIC_KEY"
  | "ACCOUNT_NOT_FOUND"
  | "NETWORK_ERROR"
  | "ENTROPY_UNAVAILABLE";

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
