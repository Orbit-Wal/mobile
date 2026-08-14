# GlobeWallet — Mobile

React Native mobile app for the GlobeWallet ecosystem, built with Expo and TypeScript.

## Stack

| Layer | Technology |
|---|---|
| Framework | Expo (SDK 50) + Expo Router v3 |
| Language | TypeScript (strict) |
| State | Zustand |
| Stellar | @stellar/stellar-sdk |
| Storage | expo-secure-store (key/secret encryption) |
| Navigation | Expo Router (file-based) |

## Getting Started

```bash
npm install
npm start          # Expo dev server
npm run android    # Android emulator
npm run ios        # iOS simulator
```

## Project Structure

```
app/               # Expo Router screens (file-based routing)
  auth/            # Onboarding, create/import wallet
  tabs/            # Main app tabs (home, assets, send, settings)
src/
  components/      # Shared UI components
  hooks/           # Custom React hooks
  services/        # Stellar SDK integration, API calls
  store/           # Zustand global state
  types/           # Shared TypeScript types
  utils/           # Formatting, validation helpers
```

## Environment Variables

Copy `.env.example` to `.env.local`:

```
EXPO_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
EXPO_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
EXPO_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
EXPO_PUBLIC_API_URL=http://localhost:4000
```

## Code Assistant

The in-app **Code Assistant** is available from the home screen. It keeps the
conversation context during the current session, renders generated code in a
monospace block, and supports copying snippets to the clipboard.

For production, set `EXPO_PUBLIC_API_URL` to your server (not a local URL) and
implement `POST /api/code-assistant/chat`. The endpoint receives `{ messages }`
and returns `{ message, code?, language? }`. Keep OpenAI or other provider API
keys on that server; never ship them in the mobile app.

## Related Repos

- [`Orbit-Wal/Globe-Wallet`](https://github.com/Orbit-Wal/Globe-Wallet) — Web frontend
- [`Orbit-Wal/backend`](https://github.com/Orbit-Wal/backend) — REST API
- [`Orbit-Wal/contract`](https://github.com/Orbit-Wal/contract) — Soroban smart contracts

---

## Development Activity Log — June 18 – Aug 14, 2026

Every push (not just merged PRs) across all four GlobeWallet repos in this
window, by contributor. Compiled from `git log`/GitHub commit history across
`Globe-Wallet`, `backend`, `contract`, and this repo (`mobile`).

**53 distinct human contributors**, ~170 non-merge commits. Activity ran
continuously from June 18 through **July 29**, then stopped — no human
commits in any repo since then; the only commits after July 29 are an
automated daily README-stats refresh in `.github`.

### Globe-Wallet (web frontend)

- **EbukaMoses** *(Jun 19)* rebuilt the receive page (QR codes, payment requests) and went through several refactor passes on it, stabilized the E2E send-flow tests that kept flaking on CI/WebKit, overhauled the off-ramp validation tests, and added the axe accessibility audits.
- **GoSTEAN** *(Jun 20)* built transaction history out properly — persistence, pagination, a sync service — then did the same for the analytics dashboard (hardened the Recharts types, added a data pipeline) and shipped the crypto-native send flow with Stellar federation lookup.
- **Chigybillionz** added trustline management so users can actually add/remove non-native Stellar assets *(Jul 17)*, then cleared out a round of CI vulnerabilities and fixed a floating-point precision bug in the conversion math *(Jul 22)*.
- **Ayinkx** cut the components/ui bundle size down and removed dead scaffolding code *(Jul 16–18)*, and separately hardened startup-env validation for CI *(Jul 17)*.
- **AbuJulaybeeb** wired up real Horizon polling and ledger settlement checks *(Jul 17)*, added aria-live regions for async balance/tx updates *(Jul 20)*, and fixed a broken SWC binary install *(Jul 21)*.
- **Ndifreke000 / Genghis-codes** added off-ramp fee utilities with well over 90% test coverage *(Jun 18)*, fixed diverging off-ramp rate constants *(Jul 11)*, then shipped EVM support (Base + Ethereum), fixed an i18n locale-routing 404, added CSP/security headers, and unblocked a stuck CI dependency-audit gate *(Jul 29)*.
- **Shepherd** implemented bearer token auth *(Jul 17)*, WebAuthn (passkey) login *(Jul 18)*, Arabic i18n/RTL support *(Jul 19)*, and wrote up the transaction query-performance design notes *(Jul 22)*.
- **Austinaminu2** *(Jun 18)* wrote the developer onboarding docs and environment setup notes, and added E2E journeys covering the core wallet flows.
- **mac-dubem** centralized error codes into one shared taxonomy *(Jul 17)* and made the FinanceServiceContainer env-driven *(Jul 18)*.
- **whiteghost0001** *(Jul 21)* replaced the mock currency conversion with real Stellar path payments and audited dynamic color contrast for accessibility.
- **od-hunter** added multi-account/account-switching support *(Jul 18)*, then gated CI on npm audit and ripped out a dead fake-DEX simulator that was pretending to be the exchange service *(Jul 19)*.
- **christabel888** *(Jul 21)* got `sendPayment` actually submitting to Stellar instead of simulating it, and fixed a duplicate `AlertTitle` declaration that was breaking the build.
- **agnesadoga-creator** *(Jun 21)* handled clipboard/share failures gracefully, validated Stellar QR payloads before encoding them, and fixed fee parsing across fixed/percentage/mixed fee types.
- **JemimahEkong** *(Jul 20)* synced the Soroban service bindings to the actual contract spec and added drift detection so they can't silently go stale again.
- **superman32432432 / ebubeb683-ship-it** *(Jul 20)* added an SSE stream endpoint and virtualized the transaction list so it doesn't choke on long histories.
- **obacollins-lab** *(Jul 21)* added claimable balances support.
- **Yunusabdul38** *(Jun 18)* built the off-ramp API route and withdrawal processing.
- **aji70** *(Jun 18)* replaced hardcoded exchange rates with a live rates API.
- **ayinde38** *(Jun 18)* wrote the conversion math helpers and their test coverage.
- **SYMBAxx** *(Jul 22)* added OpenTelemetry tracing at the service boundary.
- **Maki-Zeninn** *(Jul 22)* audited the E2E suite for tests quietly depending on mocked timers instead of real waits.
- **heymide** *(Jul 17)* fixed a precision-loss bug in round-trip conversion and added a request timeout to the rates service (it used to hang forever on a slow CoinGecko response).
- **DANeiraGarcia** *(Jul 17)* added per-route rate-limiting middleware with integration tests.
- **vrickish** *(Jun 20)* did a broad clarity/testability pass across several cross-cutting concerns.
- **Junman140** *(Jun 18)* built a shared fixtures/mock-data service to de-duplicate test setup.
- **favourawaku** *(Jun 18)* connected the convert page to shared wallet state (it was reading stale data before).
- **Mimah97** *(Jun 18)* swapped clickable divs for accessible radio buttons in payment-method selection.
- **Tukura11** *(Jun 19)* fixed a bug where the convert swap could lose valid conversion values.
- **dreamgenies** *(Jun 21)* added a fallback for sourcing the Stellar address on the receive page.
- **dreamgeneX** *(Jun 21)* aligned `AssetCode` handling with actual Stellar crypto assets.
- **yosemite01** *(Jul 13)* added CONTRIBUTING.md and a PR template that requires evidence of work.

### backend

- **yosemite01** initialized the repo (Node/Express/TypeScript) *(Jun 18)*, later added the Soroban RPC integration *(Jul 20)*, and wrote the CONTRIBUTING.md *(Jul 13)*.
- **bhanuprasad14** *(Jul 22)* added path payments, multi-sig support, and retry logic for `tx_bad_seq` failures.
- **Debbys-design** *(Jul 22)* added fee-bump support, rejected muxed addresses where they shouldn't be accepted, and added the SEP-29 memo check.
- **mac-dubem** built JWT auth with refresh-token rotation *(Jul 18)* and added an audit trail for keypair issuance *(Jul 20)*.
- **Ndifreke000** *(Jul 18)* closed a sequence-number race condition by serializing wallet sends per source account.
- **Shepherd** added env-var validation *(Jul 16)* and cursor-based pagination to the transactions endpoint *(Jul 19)*.
- **Genghis-codes** *(Jul 11)* required an API key on wallet routes and switched CORS to default-deny.

### contract (Soroban)

- **yosemite01** initialized the contracts repo *(Jun 18)*, wrote the CONTRIBUTING.md *(Jul 13)*, then added guardian-based time-locked admin recovery and at one point repaired a broken merge that had left `main` not building *(Jul 18)*.
- **mac-dubem** *(Jul 17)* bounded the whitelist and UserAssets vectors to `MAX_ASSETS=50`, with an admin migration path so existing data wasn't stranded.
- **TochukwuJustice** *(Jul 16)* fixed spend-overflow so it's rejected instead of wrapping, and added a two-step admin transfer instead of a single risky call.
- **syed-ghufran-hassan** fixed a collision where spend limits weren't disambiguated by asset issuer *(Jul 12, refined Jul 16)*.
- **Chigybillionz** *(Jul 17)* fixed spend-limit lowering so it actually reclaims spend already banked under the old, higher limit.
- **od-hunter** *(Jul 17)* documented and tested that `record_spend` is safe against reentrancy.
- **bamiebot-maker** *(Jul 16)* added an admin-gated upgrade proposal flow.
- **ONEONUORA** *(Jul 19)* added test coverage for `record_spend`.
- **Globe Wallet Developer** *(Jul 19)* added versioned, namespaced error-code ranges.
- **Genghis-codes** *(Jul 11)* moved `DailySpent`/`Allowance` to persistent storage, closing a TTL-eviction gap that could quietly reset spend limits.

### mobile (this repo)

- **yosemite01** initialized the repo (Expo/React Native/TypeScript) *(Jun 18)*, wrote the CONTRIBUTING.md *(Jul 13)*, and added guardian-based social/multi-sig recovery *(Jul 19)*.
- **Ayinkx** built the in-app code-assistant chat *(Jul 17)*, then added warn-only root detection and protected key-material screens from screen capture *(Jul 22)*.
- **Genghis-codes** *(Jul 11)* wired up the wallet create/import flow with SecureStore-backed key storage.

### .github

Org profile README *(Jul 13)* plus a GitHub Action that refreshes live
repo/commit stats daily — the only commits after **Jul 29** are that
automation running (`chore: refresh org README stats`), not new development.
