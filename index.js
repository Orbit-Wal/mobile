// Must run before any module that generates key material (stellar.ts,
// via @stellar/stellar-sdk -> tweetnacl) is evaluated. tweetnacl checks for
// crypto.getRandomValues at import time and, if it isn't present (Hermes
// has no `crypto` global by default), permanently disables its PRNG and
// throws "no PRNG" the first time a keypair is generated. This polyfill
// backs `crypto.getRandomValues` with the platform CSPRNG (SecRandomCopyBytes
// on iOS, SecureRandom on Android) before expo-router loads any screens.
import "react-native-get-random-values";
import "expo-router/entry";
