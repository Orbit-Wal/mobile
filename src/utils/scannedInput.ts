import * as StellarSdk from "@stellar/stellar-sdk";
import { parseSep7Uri, Sep7ParseError, Sep7Request } from "@/services/sep7";

// Formal input contract for untrusted scanned/deep-linked input (issue #15,
// shared with #12's deep-link handler for the same rigor):
//
//   - max length: MAX_SCANNED_PAYLOAD_LENGTH characters. Anything longer is
//     rejected before any parsing runs, so an oversized payload can't be
//     used to burn CPU/memory in a parser.
//   - character set: printable ASCII only (0x20-0x7e). Stellar addresses
//     and SEP-7 URIs are both pure ASCII by spec; anything containing
//     control characters, non-ASCII, or binary garbage is rejected up
//     front rather than passed through to a format-specific parser.
//   - accepted formats, and nothing else:
//       1. A bare Stellar address: Ed25519 public key (G...) or muxed
//          account (M...), validated via StellarSdk.StrKey.
//       2. A SEP-7 `web+stellar:pay` or `web+stellar:tx` URI, validated via
//          parseSep7Uri (src/services/sep7.ts).
//   - there is no best-effort fallback parse. Anything that isn't
//     unambiguously one of the two formats above is rejected.
export const MAX_SCANNED_PAYLOAD_LENGTH = 4096;

export type ScannedInputResult =
  | { kind: "address"; destination: string }
  | { kind: "sep7"; request: Sep7Request }
  | { kind: "invalid"; reason: string };

/**
 * Validates and classifies untrusted text pulled from a QR scan or a
 * `web+stellar:` deep link. Never throws -- callers get a discriminated
 * result they must switch on, so there's no way to accidentally treat
 * unvalidated scanned text as a trusted destination.
 */
export function validateScannedInput(raw: string): ScannedInputResult {
  if (typeof raw !== "string" || raw.length === 0) {
    return { kind: "invalid", reason: "Empty QR payload." };
  }
  if (raw.length > MAX_SCANNED_PAYLOAD_LENGTH) {
    return { kind: "invalid", reason: "QR payload is too large to be a valid Stellar address or payment link." };
  }
  if (!/^[\x20-\x7e]*$/.test(raw)) {
    return { kind: "invalid", reason: "QR payload contains invalid (non-printable/non-ASCII) characters." };
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { kind: "invalid", reason: "Empty QR payload." };
  }

  if (trimmed.startsWith("web+stellar:")) {
    try {
      const request = parseSep7Uri(trimmed);
      return { kind: "sep7", request };
    } catch (err) {
      return {
        kind: "invalid",
        reason: err instanceof Sep7ParseError ? err.message : "Malformed payment link.",
      };
    }
  }

  if (
    StellarSdk.StrKey.isValidEd25519PublicKey(trimmed) ||
    StellarSdk.StrKey.isValidMed25519PublicKey(trimmed)
  ) {
    return { kind: "address", destination: trimmed };
  }

  return { kind: "invalid", reason: "Not a recognized Stellar address or payment link." };
}
