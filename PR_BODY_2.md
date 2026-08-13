Fixes #2

## Root cause / design rationale

`getSecretKey()` in `src/services/secureStorage.ts` returned the raw Stellar secret to any caller with no authentication challenge. Today the only read call site is the recovery-enable flow (`app/guardians/config.tsx`), but the whole point of the issue is that `sendPayment()` is about to be wired to read the stored secret — at which point any process/screen that can invoke the read path (a stolen-but-unlocked device, a malicious screen reached via deep link) would be able to sign and broadcast payments with zero friction.

The gate is placed **inside `getSecretKey()` itself**, not in front of the current top-level caller. That makes every present and future read call site protected by construction — there is no way to read the secret without passing `requireLocalAuth()`. A future `sendPayment()` that calls `getSecretKey()` is automatically gated.

Fallback design decision: fail **open with an explicit, user-acknowledged warning** when the device lacks auth hardware or has nothing enrolled, matching the app's existing warn-and-continue posture for rooted devices (`checkSecurityAndWarn`). A hard fail-closed policy would brick the wallet on devices without biometrics with no recourse; the warn-and-continue path keeps the wallet usable while being fully transparent that the protection is degraded. If the user declines the fallback, the read is refused (throws `LocalAuthRequiredError`) and the secret is never returned.

## Definition of done checklist

- **Every call site that reads the secret is gated, not just the top-level signing function** — the gate lives in `getSecretKey()`, the single function through which all reads must pass (verified: `app/guardians/config.tsx` is the only current read call site and it now surfaces auth failures distinctly; future `sendPayment()` reads would inherit the gate automatically).
- **Documented fallback behavior for devices without biometrics/PIN configured** — `requireLocalAuth()` in `src/services/localAuth.ts`: if `hasHardwareAsync()` is false → explicit warning dialog, proceed only on user acknowledgement; if `isEnrolledAsync()` is false → explicit warning dialog, proceed only on acknowledgement; declining throws `LocalAuthRequiredError`. Device-fallback (PIN) is enabled via `disableDeviceFallback: false`.
- **Threat-model note** — see below.

### Threat-model note: what this gate does and does NOT protect against

- **Does protect against:** a stolen-but-unlocked device being used by someone who doesn't know the user's biometric/PIN; a malicious screen reachable via a deep link invoking the read path from the app's own UI context (the attacker cannot complete the OS auth challenge).
- **Does NOT protect against:** a compromised OS or jailbroken/rooted device (biometric secrets and the auth decision itself live in the same OS we're trusting — same caveat as the existing root-detection warning); a device with no biometrics enrolled where the user explicitly accepted the warn-and-continue fallback; malware running with root that hooks `expo-local-authentication`. The gate is a user-presence signal, not a boundary against platform compromise.
- **Deliberately not gated:** `deleteSecretKey()` — it does not read the secret; gating reads is the issue's scope.

## Evidence the code runs

```
> npx jest
PASS src/hooks/useScreenCaptureProtection.test.ts
PASS src/services/secureStorage.test.ts   (2 new)
PASS src/services/localAuth.test.ts       (6 new)
PASS src/store/__tests__/guardianStore.test.ts
PASS src/services/__tests__/guardianRecovery.test.ts

Test Suites: 5 passed, 5 total
Tests:       22 passed, 22 total

> npm run type-check
(clean — no errors)
```

Note: `npm run type-check` was previously failing on `main` because `expo-device` and `@react-native-async-storage/async-storage` (imported by the merged #8 work) were missing from `package.json`. This PR adds those two dependencies alongside `expo-local-authentication`, which is required to run and test the module this issue gates — it fixes the pre-existing breakage as a side effect.

## New or updated tests

- `src/services/localAuth.test.ts` (6): successful biometric prompt; cancelled/failed prompt throws; no-hardware fallback continue; no-hardware fallback decline throws; not-enrolled fallback continue; not-enrolled fallback decline throws.
- `src/services/secureStorage.test.ts` (2): `getSecretKey()` requires local auth before returning the stored secret; it never returns the secret when auth fails.

## Adjacent / related behavior re-verified

- Create/import flows (`saveSecretKey`) are untouched — writes are not gated (only reads, per the issue).
- `checkSecurityAndWarn` (root detection) still runs on create/import before key generation; unaffected.
- `guardians/config.tsx` enable-recovery flow now handles `LocalAuthRequiredError` with a clear "Authentication required" alert instead of a generic failure, and still proceeds to sign+submit on success.
- iOS Face ID permission string registered via the `expo-local-authentication` config plugin in `app.json`.
- No stray `console.log`/`TODO`/commented-out code left behind.
