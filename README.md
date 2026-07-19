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
