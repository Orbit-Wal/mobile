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

## Related Repos

- [`Orbit-Wal/Globe-Wallet`](https://github.com/Orbit-Wal/Globe-Wallet) — Web frontend
- [`Orbit-Wal/backend`](https://github.com/Orbit-Wal/backend) — REST API
- [`Orbit-Wal/contract`](https://github.com/Orbit-Wal/contract) — Soroban smart contracts
