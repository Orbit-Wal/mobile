Fixes #5

## Root cause / design rationale

`app/auth/create.tsx` copied the public key straight to the OS clipboard via `Clipboard.setStringAsync(publicKey)` with no expiry. On shared/managed-device environments the clipboard is readable by any app indefinitely, and the same unguarded call pattern existed in `chat.tsx` and `guardians/recover.tsx` — one careless reuse away from routing a secret key through an API with no expiry or audit point.

Rather than a one-off `setTimeout` in the screen, all clipboard writes now flow through a single pair of wrappers in `src/services/clipboard.ts`. Because this repo has no working ESLint config (the lint script fails on main with "couldn't find a configuration file"), an ESLint rule would be dead weight — so the "convention" is enforced at runtime instead, which is strictly stronger: `copyPublic()` refuses to run on text matching the Stellar secret format (prefix `S` + 55 base-32 chars) and throws. Any future developer who reaches for the public path with secret material gets a hard failure, not a linter warning.

Sensitive copies use a deliberately shorter clear window (10s vs 30s) so even a "correct" sensitive copy minimizes exposure.

## Definition of done checklist

- **Auto-clear timer (with user-visible countdown or toast) after copy** — `copyPublic`/`copySensitive` schedule an auto-clear (`Clipboard.setStringAsync("")`) after their respective windows; `create.tsx` renders a live "Copied — clipboard clears in Ns" countdown via `useClipboardCountdown`, and the other two screens show an auto-clear notice in their copy alert.
- **A shared `copySensitive()` vs `copyPublic()` wrapper so future code can't accidentally reuse the unguarded API for secrets** — `src/services/clipboard.ts` exposes `copyPublic`, `copySensitive`, `clearClipboard`, and `looksLikeStellarSecret`. All three call sites (create/chat/recover) now import from it; nothing imports `expo-clipboard` directly anymore. `copyPublic` throws on secret-format input.

## Evidence the code runs

```
> npx jest
PASS src/hooks/useScreenCaptureProtection.test.ts
PASS src/services/clipboard.test.ts   (7 new tests)
PASS src/store/__tests__/guardianStore.test.ts
PASS src/services/__tests__/guardianRecovery.test.ts

Test Suites: 4 passed, 4 total
Tests:       21 passed, 21 total
```

`npm run type-check` is clean for all files in this PR. (Two errors in `secureStorage.ts` remain on `main` — `expo-device`/`@react-native-async-storage/async-storage` missing from package.json from the merged #8 work; not touched here.)

## New or updated tests

`src/services/clipboard.test.ts` — 7 tests:
- `looksLikeStellarSecret` detects a valid Stellar secret format; rejects public keys and arbitrary text
- `copyPublic` copies and auto-clears after the public window (fake timers)
- `copyPublic` refuses secret material
- `copyPublic` with `clearAfterMs: 0` does not schedule a clear
- `copySensitive` copies and auto-clears after the shorter sensitive window
- `clearClipboard` clears immediately

## Adjacent / related behavior re-verified

- `chat.tsx` copy-code and `guardians/recover.tsx` copy-XDR flows now go through `copyPublic` and still surface the same user alerts; their existing behavior is unchanged otherwise.
- The Create Wallet flow (generate → copy → continue) is unchanged apart from the copy call and the added countdown note.
- No `console.log`/`TODO`/commented-out code left behind.
