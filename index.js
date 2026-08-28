// Must run before any module that generates key material (stellar.ts,
// via @stellar/stellar-sdk -> tweetnacl) is evaluated. tweetnacl checks for
// crypto.getRandomValues at import time and, if it isn't present (Hermes
// has no `crypto` global by default), permanently disables its PRNG and
// throws "no PRNG" the first time a keypair is generated. This polyfill
// backs `crypto.getRandomValues` with the platform CSPRNG (SecRandomCopyBytes
// on iOS, SecureRandom on Android) before expo-router loads any screens.
import "react-native-get-random-values";

// bip39 / stellar-hd-wallet (issue #9's mnemonic onboarding path) pull in
// create-hmac under the hood, which expects the Node `Buffer` global that
// Hermes doesn't provide. Polyfilled here, before any screen/service module
// loads, for the same "must run first" reason as the crypto polyfill above.
import { Buffer } from "buffer";
if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}

import "expo-router/entry";
