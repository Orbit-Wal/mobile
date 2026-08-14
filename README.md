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

| Contributor | Work |
|---|---|
| EbukaMoses | Receive page rebuild (QR/payment requests) + refactor passes; E2E send-flow stabilization for CI/WebKit; off-ramp validation test overhaul; clipboard/share navigator mocks; accessibility audits (axe) |
| GoSTEAN | Transaction history persistence + pagination + sync service; safe-area layout & nav a11y; analytics/Recharts hardening; strict chart typings; crypto-native send flow with Stellar federation lookup |
| Chigybillionz | Trustline management (add/remove non-native Stellar assets); CI vulnerability + merge fixes; conversion-math IEEE-754 float precision fix |
| Ayinkx | components/ui bundle-size optimization + dead-code removal; startup-env validation + CI hardening |
| AbuJulaybeeb | aria-live regions for async balance/tx updates; real Horizon polling + ledger settlement checks; SWC binary install fix |
| Ndifreke000 / ndii-dev | Off-ramp fee utils + >90% test coverage; EVM (Base + Ethereum) chain support; i18n locale-routing fix; CSP/security headers; CI dependency-audit unblock; hotfixes |
| Shepherd | WebAuthn (passkey) implementation; bearer token auth; i18n/RTL Arabic support; tx query-performance docs |
| Austinaminu2 | Developer onboarding docs; E2E journeys for core wallet flows; env/network setup docs |
| mac-dubem | Env-driven service resolution for FinanceServiceContainer; centralized error-code taxonomy |
| whiteghost0001 | Stellar path-payments replacing mock convert; dynamic color-contrast a11y audit |
| od-hunter | CI npm-audit gate + advisory patches; dead ExchangeService (fake DEX) removal; multi-account/account-switching |
| christabel888 | Real Stellar submission for `sendPayment`; duplicate `AlertTitle` fix |
| agnesadoga-creator | Clipboard/share failure handling; Stellar QR payload validation; fixed/percentage/mixed fee parsing |
| JemimahEkong | Synced Soroban service bindings to contract spec; ABI drift detection |
| superman32432432 / ebubeb683-ship-it | SSE stream endpoint; VirtualList virtualization for transaction views |
| obacollins-lab | Claimable balances support |
| Yunusabdul38 | Off-ramp API route (withdrawal processing) |
| aji70 | Live exchange-rate API replacing hardcoded rates |
| ayinde38 | Conversion math helpers + test coverage |
| SYMBAxx | OpenTelemetry tracing at service boundary; env/network setup docs |
| Maki-Zeninn | E2E wait-strategy audit (removed reliance on mocked timers) |
| heymide | Round-trip conversion precision fix; rates-service request timeout |
| DANeiraGarcia | Per-route rate-limiting middleware + integration tests |
| vrickish | Cross-cutting clarity/testability integration pass |
| Junman140 | Shared fixtures/mock-data service |
| favourawaku | Wired convert page to shared wallet state |
| Mimah97 | Accessible radio buttons for payment-method selection |
| Tukura11 | Convert swap value-preservation fix |
| dreamgenies | Receive-page Stellar address fallback |
| dreamgeneX | AssetCode alignment with Stellar crypto assets |
| yosemite01 | CONTRIBUTING.md + PR template requiring evidence of work |

### backend

| Contributor | Work |
|---|---|
| yosemite01 | Repo init (Node/Express/TS); Soroban RPC integration; CONTRIBUTING.md |
| bhanuprasad14 | Path payments, multi-sig, `tx_bad_seq` retry |
| Debbys-design | Fee-bump support, muxed-address rejection, SEP-29 memo check |
| mac-dubem | JWT auth with refresh-token rotation; keypair-issuance audit trail |
| Ndifreke000 | Fixed sequence-number race by serializing sends per source account |
| Shepherd | Cursor-based transaction pagination; env-var validation |
| ndii-dev | Required API key on wallet routes; default-deny CORS |

### contract (Soroban)

| Contributor | Work |
|---|---|
| yosemite01 | Repo init; guardian-based time-locked admin recovery; repaired a broken merge that left `main` non-building; CONTRIBUTING.md |
| mac-dubem | Bounded whitelist & UserAssets `Vec` to `MAX_ASSETS=50` with admin migration |
| TochukwuJustice | Spend-overflow rejection; two-step admin transfer |
| syed-ghufran-hassan | Disambiguated spend limits by asset issuer (fixed a collision) |
| Chigybillionz | Fixed spend-limit lowering not reclaiming already-banked spend |
| od-hunter | Documented + tested `record_spend` reentrancy safety |
| bamiebot-maker | Admin-gated upgrade proposal flow |
| ONEONUORA | Test coverage for `record_spend` |
| Globe Wallet Developer | Versioned, namespaced error-code ranges |
| ndii-dev | Moved `DailySpent`/`Allowance` to persistent storage, closing a TTL-eviction gap |

### mobile (this repo)

| Contributor | Work |
|---|---|
| yosemite01 | Repo init (Expo/RN/TS); guardian-based social/multi-sig recovery; CONTRIBUTING.md |
| Ayinkx | Warn-only root detection; capture protection for key-material screens; in-app code-assistant chat |
| ndii-dev | Wallet create/import flow with SecureStore-backed key storage |

### .github

Org profile README + a GitHub Action that refreshes live repo/commit stats
daily — the only commits after July 29 are that automation running
(`chore: refresh org README stats`), not new development.
