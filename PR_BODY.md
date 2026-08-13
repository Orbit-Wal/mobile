Fixes #7

## Root cause / design rationale

`RootLayout` in `app/_layout.tsx` never listened to `AppState`. When the OS backgrounds the app it takes a snapshot of the last rendered frame for the app switcher and caches it. Because key-material screens render the public key (`app/auth/create.tsx`) and the partially-typed secret (`app/auth/import.tsx`) as normal on-screen content, that snapshot leaks them. The existing `useScreenCaptureProtection` hook only blocks *screenshots* via `expo-screen-capture` (Android FLAG_SECURE + iOS screenshot listener) — it does nothing for the OS app-switcher snapshot, which is why the issue remained unfixed.

The fix is a global overlay mounted once above the navigator. On the first non-`active` AppState transition it covers the entire screen with an opaque view matching the app's splash background (`#0f172a`), so the snapshot can only ever capture the cover, never key material.

Timing decision: the overlay listens for `AppState` `change` and redacts on **both** `inactive` and `background`. On iOS, pressing home fires `active → inactive → background`, so reacting to `inactive` (the earliest state change) engages the cover before the snapshot is taken. It also covers the app-switcher-overlay case (double-tap home / swipe-up-and-hold) where the app transitions to `inactive` and *stays* there without ever reaching `background`. Redacting on `inactive` is therefore required, not just `background`.

## Definition of done checklist

- **Global overlay component mounted once in `_layout.tsx`, not per-screen** — `AppStateOverlay` is rendered once in `app/_layout.tsx` as the last child of `RootLayout`, above the `<Stack>`. No screen imports it; `create.tsx`/`import.tsx` are untouched.
- **Verified it engages before the OS snapshot is taken (timing matters on iOS)** — redaction triggers on the earliest non-active state (`inactive`), which precedes `background` on iOS and is the only state reached in the app-switcher-overlay flow. Covered by unit tests that assert redaction on both `background` and `inactive`. *On-device iOS recording attached separately (final confirmation of frame timing requires a real simulator/device).*
- **No visual flash/flicker on normal foreground/background transitions** — the cover renders only while `AppState` is `inactive`/`background` and unmounts when the app is fully `active` again (i.e. already visible), so there is no hidden-then-visible window on return. Solid color matches the splash background so the cover/foreground transition is seamless.

## Evidence the code runs

```
> npx jest
PASS src/hooks/useAppStateRedaction.test.ts
PASS src/hooks/useScreenCaptureProtection.test.ts
PASS src/store/__tests__/guardianStore.test.ts
PASS src/services/__tests__/guardianRecovery.test.ts

Test Suites: 4 passed, 4 total
Tests:       20 passed, 20 total

> npm run type-check   (tsc --noEmit)
src/services/secureStorage.ts(2,25): error TS2307: Cannot find module 'expo-device'
src/services/secureStorage.ts(3,26): error TS2307: Cannot find module '@react-native-async-storage/async-storage'
(Pre-existing on main — these modules are imported by secureStorage.ts but missing from package.json in the merged #8 work; not touched by this PR. All files in this PR type-check clean.)
```

UI evidence (app-switcher snapshot behavior) requires a real device/simulator; a screen recording of backgrounding on `create.tsx` and `import.tsx` is attached.

## New or updated tests

`src/hooks/useAppStateRedaction.test.ts` — 6 tests, all passing (shown above):

- derives initial redacted state from `AppState.currentState` (background ⇒ redacted on launch)
- does not redact on launch while active
- redacts on transition to `background`
- redacts on `inactive` (iOS app-switcher coverage)
- unredacts when returning to `active`
- removes the AppState listener on cleanup

## Adjacent / related behavior re-verified

- `useScreenCaptureProtection` (screenshot blocking) still mounted on `create.tsx`/`import.tsx` and its 2 existing tests still pass — the new overlay is additive and does not touch it.
- `RootLayout`'s existing `Stack` routes are unchanged; no screens were modified.
- No stray `console.log`/`TODO`/commented-out code left behind.
