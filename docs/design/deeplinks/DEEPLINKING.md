# Deep-Link Scheme Hijacking: Audit & Verified-Link Migration

Design doc for Orbit-Wal/mobile#4: *"Deep-link URL scheme hijacking review
for the `globewallet://` scheme."*

Status: audit complete + guard implemented (this repo). The OS-level
verification steps below (assetlinks / apple-app-site-association hosting,
two-app interception test) require a real production domain and are the
remaining deployment steps before any funds-moving deep link ships.

---

## 1. Threat model

Custom URL schemes (`globewallet://`) are **not exclusively claimable**:

- **Android**: any installed app can declare the same scheme. The system
  shows the user a disambiguation prompt if multiple apps register it, and
  a malicious app that is already installed can register `globewallet://`
  before (or alongside) ours and intercept the tap.
- **iOS**: schemes are namespaced per-app-store-claimed bundle id and the
  system blocks duplicate scheme registration from the App Store, but
  schemes remain guessable, non-verifiable, and can be tricked via
  malicious web pages + `window.open`/redirect abuse. iOS also gives the
  OS no cryptographic proof that the scheme belongs to us.

The scheme name itself (`globewallet`) is public (it's in this repo's
`app.json`), so it is trivially guessable.

**What makes this dangerous for a wallet:** the moment a deep link carries
an *action* — "pay N XLM to address G..." — an intercepted `globewallet://`
link would let a spoofing app or a malicious web page inject that action
into our app with no cryptographic guarantee that it came from us.

## 2. Current and near-term deep-linkable routes

Today **no route reads URL parameters** (no `useLocalSearchParams`/
`useGlobalSearchParams` anywhere; verified on `main`). Expo Router makes
every route below addressable via `globewallet://<route>` by default.

| Route | Sensitive today? | Funds-moving? |
|---|---|---|
| `globewallet://` (root → home or welcome) | No | No |
| `globewallet://auth/welcome` | No | No |
| `globewallet://auth/create` | Yes (creates key) | Near-term no |
| `globewallet://auth/import` | **Yes** (imports secret) | Near-term no |
| `globewallet://tabs/home` | Yes (shows balances/address) | No |
| `globewallet://chat` | No | No |
| `globewallet://guardians` | Yes (recovery config) | No |
| `globewallet://guardians/add` | Yes (adds co-signer) | No |
| `globewallet://guardians/config` | **Yes** (signs recovery tx) | Near-term no |
| `globewallet://guardians/recover` | **Yes** (collects signatures) | Near-term no |
| `globewallet://guardians/status` | Yes | No |
| *planned* `globewallet://pay` / `globewallet://send` | **Yes** | **Yes** |
| *planned* receive-address sharing links | Yes | No |

Even today, a spoofed `globewallet://auth/import` or
`globewallet://guardians/config` link deep-linking into a key-material or
signing screen is a phishing surface (screen-squatting — the user lands on
a screen that *looks* like ours because it is ours, but was opened by an
attacker-controlled link). Biometric gating (issue #2) and the
backgrounding redaction (#7) reduce but do not eliminate that surface.

## 3. Migration plan to verified links

Any route that can move funds or import secrets must be reachable **only**
via verified links. Custom-scheme delivery is retained at most for
non-sensitive, low-risk navigation — and ideally retired entirely.

### 3.1 Chosen design

1. **Canonical verified host**: one HTTPS domain controlled by Orbit-Wal
   (placeholder `links.globewallet.example` below; replace everywhere with
   the real one at rollout).
2. **iOS Universal Links**: `apple-app-site-association` served at
   `https://<host>/.well-known/apple-app-site-association` (or
   `/apple-app-site-association`), listing bundle id
   `com.orbitwal.globewallet`, and
   `ios.associatedDomains = ["applinks:<host>"]` in `app.json`.
3. **Android App Links**: `.well-known/assetlinks.json` served at the same
   host, declaring the app's signing certificate SHA-256 fingerprints, and
   an https intent filter with `android:autoVerify="true"` in the manifest
   via `app.json`:
   ```json
   "android": {
     "intentFilters": [
       {
         "action": "VIEW",
         "data": [
           { "scheme": "https", "host": "<host>", "pathPrefix": "/pay" }
         ],
         "category": ["BROWSABLE", "DEFAULT"],
         "autoVerify": true
       }
     ]
   }
   ```
4. **App-side validation** (`src/services/deepLinks.ts`, this PR): every
   incoming deep link passes `assertSafeDeepLink(url, action)` before any
   route handler touches it. The guard accepts **only** `https` URLs on the
   canonical host; anything arriving via `globewallet://` for a
   funds-moving action is rejected outright.
5. **No funds-moving route ships with the custom scheme as its only
   transport.** Until steps 2–3 are live on a real domain, no `pay`/`send`
   deep link is exposed.

### 3.2 Rollout checklist (maintainers, requires real domain)

- [ ] Set the real host in `app.json` (`associatedDomains`, intent filter)
      and in `src/services/deepLinks.ts` (`CANONICAL_HOST`).
- [ ] Host `/.well-known/assetlinks.json` and
      `/.well-known/apple-app-site-association`.
- [ ] Verify Android: `adb shell am start -a android.intent.action.VIEW
      -d "https://<host>/pay?..." com.orbitwal.globewallet` opens the app
      directly (no disambiguation), and a debug app registering
      `globewallet://` cannot receive it.
- [ ] Verify iOS: the AASA fetches successfully and a Universal Link opens
      the app directly from Safari/Notes.
- [ ] Keep `globewallet://` for at most non-sensitive navigation, or remove
      it.

### 3.3 Android interception regression test (manual, two-app)

The definitive OS-level proof needs two installed apps and a device:

1. Build a trivial debug app that registers only `android:scheme="globewallet"`.
2. Install both. Tap a `globewallet://` link.
3. Pass: the system prompt (or our app) appears and the spoofing app can
   never claim the **https** host link, because App Links verification
   requires the signed assetlinks.json — a spoofed app cannot mint that.
4. Document the device/OS versions in the PR that ships a funds-moving
   route.

This is automated at the unit level in this PR by
`src/services/__tests__/deepLinks.test.ts`, which proves the app's own
deep-link guard rejects spoofed-scheme links for sensitive actions.

## 4. What the guard does and does not prove

- **Does**: rejects non-HTTPS and non-canonical-host deep links before any
  action handling; makes it structurally impossible for a `globewallet://`
  link to trigger a funds-moving action once one exists.
- **Does not**: prove the OS route resolution on real hardware (that needs
  the §3.3 manual test); protect against phishing that doesn't use deep
  links at all.
