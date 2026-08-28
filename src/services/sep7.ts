import * as StellarSdk from "@stellar/stellar-sdk";

// SEP-0007 URI parsing (issue #12). Every field here is untrusted input --
// this file only parses and validates; it never fetches a callback, submits
// a transaction, or otherwise acts on a request. Callers are responsible for
// surfacing everything (including the unverified-origin warning) to the user
// before treating any of this as something to sign.

const SEP7_SCHEME = "web+stellar:";
const MAX_URI_LENGTH = 4096;

const VALID_MEMO_TYPES = ["MEMO_TEXT", "MEMO_ID", "MEMO_HASH", "MEMO_RETURN"] as const;
type MemoType = (typeof VALID_MEMO_TYPES)[number];

export class Sep7ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Sep7ParseError";
  }
}

interface Sep7Common {
  /** Present only if both origin_domain and signature were present on the
   * URI. Cryptographic verification against the domain's stellar.toml
   * SIGNING_KEY is NOT implemented (see TODO in PR description) -- this is
   * therefore always `false`, and callers MUST show an untrusted-origin
   * warning for every SEP-7 request regardless of this field. */
  originVerified: boolean;
  originDomain?: string;
  signature?: string;
  callback?: string;
  msg?: string;
}

export interface Sep7PayRequest extends Sep7Common {
  operation: "pay";
  destination: string;
  amount?: string;
  assetCode?: string;
  assetIssuer?: string;
  memo?: string;
  memoType?: MemoType;
}

export interface Sep7TxRequest extends Sep7Common {
  operation: "tx";
  xdr: string;
  networkPassphrase?: string;
}

export type Sep7Request = Sep7PayRequest | Sep7TxRequest;

function requirePrintableAscii(raw: string): void {
  if (!/^[\x20-\x7e]*$/.test(raw)) {
    throw new Sep7ParseError("Payment link contains invalid (non-printable/non-ASCII) characters.");
  }
}

function isValidAmount(value: string): boolean {
  return /^\d{1,17}(\.\d{1,7})?$/.test(value) && parseFloat(value) > 0;
}

function isValidAssetCode(value: string): boolean {
  return /^[a-zA-Z0-9]{1,12}$/.test(value);
}

function isValidStellarAddress(value: string): boolean {
  return StellarSdk.StrKey.isValidEd25519PublicKey(value) || StellarSdk.StrKey.isValidMed25519PublicKey(value);
}

/**
 * Parses and validates a SEP-0007 `web+stellar:` URI. Deliberately rejects
 * anything malformed or ambiguous rather than best-effort parsing it --
 * a partially-understood payment request driving a send flow is more
 * dangerous than one that's simply refused (shared rigor with issue #15's
 * scanned-input contract; see src/utils/scannedInput.ts).
 */
export function parseSep7Uri(raw: string): Sep7Request {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Sep7ParseError("Empty payment link.");
  }
  if (raw.length > MAX_URI_LENGTH) {
    throw new Sep7ParseError("Payment link is too large to be a valid SEP-7 request.");
  }
  requirePrintableAscii(raw);

  if (!raw.startsWith(SEP7_SCHEME)) {
    throw new Sep7ParseError('Not a "web+stellar:" payment link.');
  }

  const rest = raw.slice(SEP7_SCHEME.length);
  const qIndex = rest.indexOf("?");
  const operation = qIndex === -1 ? rest : rest.slice(0, qIndex);
  const queryString = qIndex === -1 ? "" : rest.slice(qIndex + 1);

  if (operation !== "pay" && operation !== "tx") {
    throw new Sep7ParseError(`Unsupported SEP-7 operation "${operation}". Only "pay" and "tx" are supported.`);
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(queryString);
  } catch {
    throw new Sep7ParseError("Payment link query string could not be parsed.");
  }

  // Reject conflicting duplicate keys outright rather than silently taking
  // the first/last one -- an ambiguous URI is exactly what issue #12 asks
  // to refuse rather than best-effort-parse.
  const seenKeys = new Set<string>();
  for (const key of params.keys()) {
    if (seenKeys.has(key)) {
      throw new Sep7ParseError(`Payment link has conflicting duplicate "${key}" parameters.`);
    }
    seenKeys.add(key);
  }

  const originDomain = params.get("origin_domain") ?? undefined;
  const signature = params.get("signature") ?? undefined;
  const callback = params.get("callback") ?? undefined;
  const msg = params.get("msg") ?? undefined;

  if (msg !== undefined && msg.length > 300) {
    throw new Sep7ParseError("Payment link message exceeds the 300-character SEP-7 limit.");
  }
  // A signature with no domain to verify it against (or vice versa) can't
  // be checked at all -- treat as malformed rather than silently dropping
  // half of it.
  if ((originDomain && !signature) || (signature && !originDomain)) {
    throw new Sep7ParseError(
      "Payment link has a signature without an origin_domain (or vice versa) -- it can't be verified."
    );
  }

  // See Sep7Common.originVerified doc comment: verification is not
  // implemented yet, so this is always false.
  const originVerified = false;

  if (operation === "tx") {
    const xdr = params.get("xdr");
    if (!xdr) {
      throw new Sep7ParseError('SEP-7 "tx" request is missing the required "xdr" parameter.');
    }
    const networkPassphrase = params.get("network_passphrase") ?? undefined;
    try {
      // Validate it's at least a well-formed transaction envelope before it
      // gets anywhere near a confirmation screen.
      StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase ?? StellarSdk.Networks.PUBLIC);
    } catch {
      throw new Sep7ParseError('SEP-7 "tx" request\'s "xdr" parameter is not a valid transaction envelope.');
    }
    return { operation: "tx", xdr, networkPassphrase, callback, msg, originDomain, signature, originVerified };
  }

  // operation === "pay"
  const destination = params.get("destination");
  if (!destination) {
    throw new Sep7ParseError('SEP-7 "pay" request is missing the required "destination" parameter.');
  }
  if (!isValidStellarAddress(destination)) {
    throw new Sep7ParseError(`SEP-7 "pay" request's destination "${destination}" is not a valid Stellar address.`);
  }

  const amount = params.get("amount") ?? undefined;
  if (amount !== undefined && !isValidAmount(amount)) {
    throw new Sep7ParseError(`SEP-7 "pay" request has an invalid amount "${amount}".`);
  }

  const assetCode = params.get("asset_code") ?? undefined;
  const assetIssuer = params.get("asset_issuer") ?? undefined;
  if ((assetCode && !assetIssuer) || (assetIssuer && !assetCode)) {
    throw new Sep7ParseError('SEP-7 "pay" request has "asset_code" without "asset_issuer" (or vice versa).');
  }
  if (assetCode && !isValidAssetCode(assetCode)) {
    throw new Sep7ParseError(`SEP-7 "pay" request has an invalid asset_code "${assetCode}".`);
  }
  if (assetIssuer && !StellarSdk.StrKey.isValidEd25519PublicKey(assetIssuer)) {
    throw new Sep7ParseError(`SEP-7 "pay" request has an invalid asset_issuer "${assetIssuer}".`);
  }

  const memo = params.get("memo") ?? undefined;
  let memoType: MemoType | undefined;
  if (memo !== undefined) {
    const memoTypeRaw = params.get("memo_type") ?? "MEMO_TEXT";
    if (!(VALID_MEMO_TYPES as readonly string[]).includes(memoTypeRaw)) {
      throw new Sep7ParseError(`SEP-7 "pay" request has an unsupported memo_type "${memoTypeRaw}".`);
    }
    memoType = memoTypeRaw as MemoType;
    if (memoType === "MEMO_ID" && !/^\d+$/.test(memo)) {
      throw new Sep7ParseError("SEP-7 MEMO_ID must be a non-negative integer.");
    }
    if (memoType === "MEMO_TEXT" && memo.length > 28) {
      throw new Sep7ParseError("SEP-7 MEMO_TEXT must be at most 28 bytes.");
    }
    if ((memoType === "MEMO_HASH" || memoType === "MEMO_RETURN") && !/^[A-Za-z0-9+/]{43}=$/.test(memo)) {
      throw new Sep7ParseError(`SEP-7 ${memoType} must be base64-encoded 32 bytes.`);
    }
  }

  return {
    operation: "pay",
    destination,
    amount,
    assetCode,
    assetIssuer,
    memo,
    memoType,
    callback,
    msg,
    originDomain,
    signature,
    originVerified,
  };
}
