# iOS Keychain vs Android Keystore parity for `expo-secure-store`

Design doc for Orbit-Wal/mobile#3: *"Audit iOS Keychain vs Android Keystore
parity for SecureStore usage."*

Status: audit complete + runtime detection with warn-only policy (this PR).

---

## 1. What we actually do today

`src/services/secureStorage.ts` calls

```ts
SecureStore.setItemAsync(SECRET_KEY_STORAGE_KEY, secret, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});
```

`WHEN_UNLOCKED_THIS_DEVICE_ONLY` is an **iOS-only** accessibility constant
mapping to `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`. `expo-secure-store`
accepts and ignores it on Android, so Android behavior is whatever
`expo-secure-store` does by default — which is **not** the same guarantee.

## 2. Guarantee matrix

| Platform | Backing store | Key material | Hardware backing | Backup/portability | Tier |
|---|---|---|---|---|---|
| iOS (all supported) | Keychain | AES-256, device-bound | Data-protection key hierarchy rooted in the Secure Enclave | `THIS_DEVICE_ONLY` ⇒ never migrates to iCloud backup or another device | **strong** |
| Android 6+ (API 23+) physical | EncryptedSharedPreferences + Android Keystore (AES/GCM) | Keystore-held AES key | TEE-backed when the SoC provides it (default Keystore behavior) | Key is in the Keystore (not plaintext); EncryptedSharedPreferences file is device-scoped | **strong** when class-3 biometric enrolled (proxy for TEE), else **weak** |
| Android 9+ (API 28+) w/ StrongBox | same as above | same | StrongBox available **but only if the key is created with `isStrongBoxBacked(true)`** — `expo-secure-store` does not request it, so we get TEE at best, never explicit StrongBox | same | **strong** |
| Android emulator | same | same | Software-only Keystore | n/a | **weak** |
| Android rooted / iOS jailbroken (any API level) | — | — | Keystore/Keychain protections are bypassable by an attacker with root | — | **weak** |
| Android, PIN-only or nothing enrolled | same | same | Cannot confirm hardware backing (no biometric key usage to force TEE path) | — | **weak** |

Caveats stated plainly:

- `expo-secure-store` on Android never opts into StrongBox. The "strong"
  tier therefore means TEE-backed Keystore, not StrongBox.
- A rooted/jailbroken device negates every tier above — the attacker reads
  Keystore/Keychain contents the same way the app does.
- The matrix is about **at-rest protection** of the stored secret. It is
  orthogonal to the biometric *gate* (issue #2) that sits in front of reads.

## 3. Runtime detection (this PR)

`src/services/keychainParity.ts` assesses the tier at run time from the
APIs the app already depends on:

- `Device.isRootedExperimentalAsync()` → rooted ⇒ **weak**
- `Device.isDevice` → emulator ⇒ **weak**
- `LocalAuthentication.getEnrolledLevelAsync()` → `BIOMETRIC` on a physical
  Android device ⇒ **strong** (class-3 biometric in practice implies a
  TEE/StrongBox-backed keystore); `SECRET`/`NONE` ⇒ **weak**
- iOS physical, not jailbroken ⇒ **strong** (Keychain)

`saveSecretKey()` in `src/services/secureStorage.ts` runs this assessment
and, when the tier is not `strong`, shows a non-dismissable warning before
storing (warn-only — the secret is still saved). The assessment is also
exported for reuse by other flows.

## 4. Decision: refuse to store below a minimum tier?

**Decision: warn but do not refuse.** Rationale:

- The alternative — refusing to store the secret below a "strong" tier —
  would brick the wallet on legitimate older hardware, emulators (dev),
  and PIN-only devices with no user recourse, matching the exact failure
  mode the repo's root-detection issue (#8) rejected.
- The root check already surfaces the compromised-device risk at key
  creation; the parity warning is the equivalent, per-storage, at-rest
  transparency.
- If a hard floor is ever wanted, the correct place is a future
  migration-aware release gate, not a silent refusal in the storage layer.

This is a documented, deliberate policy decision — see the PR description
for the trade-off analysis.
