# Fixes #8: Jailbreak/root detection: decide real security value before building it

## Design Decision Rationale
When assessing root/jailbreak detection for SecureStore consumers, a "block entirely" policy provides a false sense of security while guaranteeing a terrible UX for legitimate power users. A determined attacker with root access can trivially bypass client-side checks (e.g., hooking `isRooted` methods via Magisk/Frida). Therefore, blocking only stops legitimate users who root their devices for customization, potentially locking them out of their funds permanently with no recourse. The chosen policy is **Warn-only**. This approach fulfills the application's duty of care by informing the user of the degraded hardware keystore protections, allowing them to acknowledge the risk and proceed without creating false-positive lockouts.

## Definition of Done Checklist
- **Written threat model with an explicit chosen policy and rationale**: Addressed above in the rationale section. Policy is warn-only.
- **Implementation matches the chosen policy, not a generic bypassable check copy-pasted from a blog post**: Used `expo-device`'s `isRootedExperimentalAsync` in `src/services/secureStorage.ts` to implement a dismissable warning alert that sets a flag in `AsyncStorage`.
- **No false-positive lockout path with zero user recourse**: Users are presented with an "I Understand" button on the warning alert that allows them to bypass the warning and continue, with no permanent blocking. Errors in the check itself fail open.

## Evidence the Code Runs
```
> cmd.exe /c npx tsc --noEmit
(Success - no type errors)

Tested flow manually:
1. Navigated to Create Wallet / Import Wallet screen
2. Simulated root check triggered Alert
3. User presses "I Understand", key generation/import proceeds successfully.
```

## New or Updated Tests
*No new tests for expo-device as it requires physical device mock testing, but the `secureStorage.ts` check fails open correctly in simulated environments.*

## Adjacent/Related Behavior Verified
Re-verified that `saveSecretKey` and the overall import/creation flows in `app/auth/create.tsx` and `app/auth/import.tsx` function as normal if the device is not rooted (the check exits early returning true). Screen capture protection remains intact.
