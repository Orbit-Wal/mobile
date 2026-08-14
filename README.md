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

- **EbukaMoses** rebuilt the receive page (QR codes, payment requests) and went through several refactor passes on it, stabilized the E2E send-flow tests that kept flaking on CI/WebKit, overhauled the off-ramp validation tests, and added the axe accessibility audits.
- **GoSTEAN** built transaction history out properly — persistence, pagination, a sync service — then did the same for the analytics dashboard (hardened the Recharts types, added a data pipeline) and shipped the crypto-native send flow with Stellar federation lookup.
- **Chigybillionz** added trustline management so users can actually add/remove non-native Stellar assets, cleared out a round of CI vulnerabilities, and fixed a floating-point precision bug in the conversion math.
- **Ayinkx** cut the components/ui bundle size down and removed dead scaffolding code, and separately hardened startup-env validation for CI.
- **AbuJulaybeeb** added aria-live regions for async balance/tx updates, wired up real Horizon polling and ledger settlement checks (replacing a stub), and fixed a broken SWC binary install.
- **Ndifreke000 / Genghis-codes** added off-ramp fee utilities with well over 90% test coverage, shipped EVM support (Base + Ethereum), fixed an i18n locale-routing 404, added CSP/security headers, and unblocked a stuck CI dependency-audit gate.
- **Shepherd** implemented WebAuthn (passkey) login, bearer token auth, and Arabic i18n/RTL support, plus wrote up the transaction query-performance design notes.
- **Austinaminu2** wrote the developer onboarding docs and environment setup notes, and added E2E journeys covering the core wallet flows.
- **mac-dubem** made the FinanceServiceContainer env-driven and centralized error codes into one shared taxonomy instead of scattered magic strings.
- **whiteghost0001** replaced the mock currency conversion with real Stellar path payments and audited dynamic color contrast for accessibility.
- **od-hunter** gated CI on npm audit, ripped out a dead fake-DEX simulator that was pretending to be the exchange service, and added multi-account/account-switching support.
- **christabel888** got `sendPayment` actually submitting to Stellar instead of simulating it, and fixed a duplicate `AlertTitle` declaration that was breaking the build.
- **agnesadoga-creator** handled clipboard/share failures gracefully, validated Stellar QR payloads before encoding them, and fixed fee parsing across fixed/percentage/mixed fee types.
- **JemimahEkong** synced the Soroban service bindings to the actual contract spec and added drift detection so they can't silently go stale again.
- **superman32432432 / ebubeb683-ship-it** added an SSE stream endpoint and virtualized the transaction list so it doesn't choke on long histories.
- **obacollins-lab** added claimable balances support.
- **Yunusabdul38** built the off-ramp API route and withdrawal processing.
- **aji70** replaced hardcoded exchange rates with a live rates API.
- **ayinde38** wrote the conversion math helpers and their test coverage.
- **SYMBAxx** added OpenTelemetry tracing at the service boundary.
- **Maki-Zeninn** audited the E2E suite for tests quietly depending on mocked timers instead of real waits.
- **heymide** fixed a precision-loss bug in round-trip conversion and added a request timeout to the rates service (it used to hang forever on a slow CoinGecko response).
- **DANeiraGarcia** added per-route rate-limiting middleware with integration tests.
- **vrickish** did a broad clarity/testability pass across several cross-cutting concerns.
- **Junman140** built a shared fixtures/mock-data service to de-duplicate test setup.
- **favourawaku** connected the convert page to shared wallet state (it was reading stale data before).
- **Mimah97** swapped clickable divs for accessible radio buttons in payment-method selection.
- **Tukura11** fixed a bug where the convert swap could lose valid conversion values.
- **dreamgenies** added a fallback for sourcing the Stellar address on the receive page.
- **dreamgeneX** aligned `AssetCode` handling with actual Stellar crypto assets.
- **yosemite01** added CONTRIBUTING.md and a PR template that requires evidence of work.

### backend

- **yosemite01** initialized the repo (Node/Express/TypeScript), later added the Soroban RPC integration, and wrote the CONTRIBUTING.md.
- **bhanuprasad14** added path payments, multi-sig support, and retry logic for `tx_bad_seq` failures.
- **Debbys-design** added fee-bump support, rejected muxed addresses where they shouldn't be accepted, and added the SEP-29 memo check.
- **mac-dubem** built JWT auth with refresh-token rotation and added an audit trail for keypair issuance.
- **Ndifreke000** closed a sequence-number race condition by serializing wallet sends per source account.
- **Shepherd** added cursor-based pagination to the transactions endpoint and env-var validation.
- **Genghis-codes** required an API key on wallet routes and switched CORS to default-deny.

### contract (Soroban)

- **yosemite01** initialized the contracts repo, added guardian-based time-locked admin recovery, and at one point repaired a broken merge that had left `main` not building — plus the CONTRIBUTING.md.
- **mac-dubem** bounded the whitelist and UserAssets vectors to `MAX_ASSETS=50`, with an admin migration path so existing data wasn't stranded.
- **TochukwuJustice** fixed spend-overflow so it's rejected instead of wrapping, and added a two-step admin transfer instead of a single risky call.
- **syed-ghufran-hassan** fixed a collision where spend limits weren't disambiguated by asset issuer.
- **Chigybillionz** fixed spend-limit lowering so it actually reclaims spend already banked under the old, higher limit.
- **od-hunter** documented and tested that `record_spend` is safe against reentrancy.
- **bamiebot-maker** added an admin-gated upgrade proposal flow.
- **ONEONUORA** added test coverage for `record_spend`.
- **Globe Wallet Developer** added versioned, namespaced error-code ranges.
- **Genghis-codes** moved `DailySpent`/`Allowance` to persistent storage, closing a TTL-eviction gap that could quietly reset spend limits.

### mobile (this repo)

- **yosemite01** initialized the repo (Expo/React Native/TypeScript), added guardian-based social/multi-sig recovery, and wrote the CONTRIBUTING.md.
- **Ayinkx** added warn-only root detection, protected key-material screens from screen capture, and built the in-app code-assistant chat.
- **Genghis-codes** wired up the wallet create/import flow with SecureStore-backed key storage.

### .github

Org profile README + a GitHub Action that refreshes live repo/commit stats
daily — the only commits after July 29 are that automation running
(`chore: refresh org README stats`), not new development.
