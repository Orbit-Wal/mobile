# Prevent capture of key-material screens (#6)

Closes #6

## Root cause and design decision

Key-generation and key-import screens handled wallet key material without a shared screen-capture boundary. This left Android screens capturable and gave iOS no response after a screenshot. The fix centralizes the platform-specific behavior in `useScreenCaptureProtection()`: it enables Expo's native capture prevention while a protected screen is mounted, then restores the prior behavior when it unmounts. On Android this maps to `FLAG_SECURE`, which blocks screenshots and screen recordings. iOS does not permit apps to block screenshots, so the hook installs the supported screenshot listener and warns immediately after detection.

Keeping this as a hook makes protection explicit and reusable for any future secret-key reveal screen, instead of duplicating native capture calls in route components.

## Definition of done

- Reusable `useScreenCaptureProtection()` hook applied to create/import and ready for secret-reveal screens: implemented in `src/hooks/useScreenCaptureProtection.ts` and used by both `app/auth/create.tsx` and `app/auth/import.tsx`.
- iOS screenshot detection and response: the hook registers an iOS listener and displays a sensitive-information warning after a screenshot is detected.
- Android `FLAG_SECURE` prevention: the hook calls Expo's `preventScreenCaptureAsync()` while protected screens are mounted and restores capture on cleanup.

## Verification

```text
[paste CI/local output here after npm install and test run]
```

- Added hook tests covering Android prevention/cleanup and iOS screenshot detection/cleanup.
- Re-verified adjacent onboarding behavior: the create route still stores a generated secret and advances after continuing; the import route still validates, stores, and advances with a valid secret.

## Device evidence

Attach an Android recording showing a blocked screenshot/recording attempt and an iOS recording showing the post-screenshot warning before merging.
