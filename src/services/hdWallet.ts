import StellarHDWallet from "stellar-hd-wallet";
import * as StellarSdk from "@stellar/stellar-sdk";
import { StellarServiceError } from "@/services/stellar";

// SEP-0005-compliant BIP-39 mnemonic onboarding (issue #9), implemented via
// `stellar-hd-wallet`, which derives m/44'/148'/{index}' (SLIP-0010 ed25519)
// keys from a BIP-39 mnemonic -- the same path scheme every other major
// Stellar wallet uses, so phrases generated here import cleanly elsewhere
// and vice versa.
//
// Backward-compatibility decision: raw-secret create/import (app/auth/create.tsx,
// app/auth/import.tsx) remain fully supported, unchanged, side-by-side with the
// mnemonic path -- they are not deprecated. Existing wallets created under the
// raw-secret scheme need no migration: a Stellar secret key is a Stellar secret
// key regardless of whether it was typed in directly or derived from a phrase,
// and secureStorage.ts stores it identically either way. Mnemonic is presented
// as the recommended default in app/auth/welcome.tsx; raw secret entry stays
// available as the power-user/advanced path.
//
// Account index is always 0 here: this wallet does not yet expose "multiple
// accounts derived from one phrase" (issue #18's multi-account support is a
// separate list of independently-generated/imported accounts, not HD child
// indices of a single phrase) -- index 0 is SEP-5's default first account.
const ACCOUNT_INDEX = 0;

export function generateMnemonic(entropyBits: 128 | 256 = 128): string {
  // 128 bits -> 12 words, the BIP-39 default most wallets use; 256 -> 24
  // words for users who want the larger security margin.
  return StellarHDWallet.generateMnemonic({ entropyBits });
}

export function validateMnemonic(mnemonic: string): boolean {
  return StellarHDWallet.validateMnemonic(mnemonic.trim());
}

export function deriveKeypairFromMnemonic(mnemonic: string, index: number = ACCOUNT_INDEX): StellarSdk.Keypair {
  const trimmed = mnemonic.trim();
  if (!StellarHDWallet.validateMnemonic(trimmed)) {
    throw new StellarServiceError(
      "That recovery phrase isn't a valid BIP-39 mnemonic. Check the word order, spelling, and that all words are from the standard wordlist.",
      "INVALID_MNEMONIC"
    );
  }
  const wallet = StellarHDWallet.fromMnemonic(trimmed);
  return StellarSdk.Keypair.fromSecret(wallet.getSecret(index));
}
