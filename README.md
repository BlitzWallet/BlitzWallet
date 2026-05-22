<img src=".github/assets/images/wordmark.png" alt="Blitz Wallet" width="100%">

<hr/>

Blitz Wallet is a self-custodial Bitcoin wallet built with React Native and Expo. Powered by the [Spark](https://spark.info) network, Blitz delivers fast, low-fee Bitcoin payments with a simple user experience.

<hr>

> **Self-Custodial** — Neither Blitz nor Spark has access to your seed phrase or funds. If you lose your seed phrase, access to your funds will be lost. Do not share your seed phrase with anyone.

## Download

[![Google Play](.github/assets/images/google-play.svg)](https://play.google.com/store/apps/details?id=com.blitzwallet)
[![IOS Appstore](.github/assets/images/app-store.svg)](https://apps.apple.com/us/app/blitz-wallet/id6476810582)

## Features

### Payments

- **Send Bitcoin** — via QR code, camera roll, clipboard, contacts, or Lightning address
- **Receive Bitcoin** — via Lightning, Liquid, Spark, On-chain, roostock QR codes
- **Stablecoin Payments** — send and receive USDB (LRC-20) tokens on Spark
- **LNURL Support** — pay, withdraw, and auth
- **Bulk Payments** — send to multiple recipients in a single operation
- **Split Payments** — split a payment across multiple sources
- **Pay Links** — create reusable payment request links with optional amounts and descriptions
- **Lightning Address** — receive payments to your @blitzwalletapp.com address

### Wallet Management

- **Savings Goals** — create named savings goals, deposit and withdraw funds, track progress
- **Accumulation Addresses** — receive stablecoins (USDC/USDT) on Solana, Base, Ethereum, Arbitrum, Optimism, Polygon, Tron, or Plasma and auto-convert to BTC or USDB
- **Pools** — create group funding pools, invite contributors, and track progress toward a target amount
- **Bitcoin/Stablecoin Swaps** — swap between BTC and USDB directly within the wallet
- **Sub-Accounts** — create multiple accounts within a single wallet
- **Contacts** — save and manage contacts for quick payments
- **Transaction History** — detailed payment info (date, time, fee, type) and technical details (payment hash, preimage, ID)
- **CSV Export** — export your transaction history
- **Analytics & Budgeting** — view spending and income charts, set budgets, track against limits
- **Nostr Wallet Connect (NWC)** — connect your wallet to Nostr apps

### Built-in Store

- **Gift Cards** — purchase gift cards from hundreds of brands
- **Online Listings** — browse and discover Bitcoin-accepting businesses
- **BTC Map** — find Bitcoin merchants near you on an interactive map

### Settings & Security

- **Biometric Login** — opt-in Face ID / fingerprint authentication
- **PIN Protection** — secure your wallet with a custom PIN
- **Wallet Recovery** — restore from your 12-word seed phrase with word suggestions
- **Fiat Display** — support for numerous fiat currencies
- **Balance Denomination** — switch between fiat, sats, or hidden
- **Themes** — Dark mode, Light mode, and Lights Out mode

### Localization

Available in 8 languages: English, Spanish, French, German, Italian, Portuguese (Brazil), Swedish, and Russian.

### Technical Highlights

- **Spark SDK** — WebView-based WASM runtime with encrypted bridge (ECDH + AES-256-GCM) and native React Native SDK fallback
- **Flashnet** — instant off-chain transfers between Spark wallets
- **Liquid Network** — Breez SDK integration for Liquid sidechain support
- **Atomic Swaps** — Boltz integration for trustless cross-chain swaps
- **Rootstock** — receive via RSK bridge
- **Push Notifications** — Firebase Cloud Messaging for payment alerts
- **Point of Sale** — merchant-facing receive mode

## Contributing

We rely on GitHub for bug tracking. Before reporting a new bug, please search the [existing issues](https://github.com/BlitzWallet/BlitzWallet/issues) to see if it has already been reported. If not, feel free to create a new issue.

We welcome pull requests to improve the codebase or introduce new features. All pull requests will be reviewed by the Blitz team.

## Build

To run the project locally, follow these steps:

Coming soon...

## License

Blitz Wallet is released under the terms of the Apache 2.0 license. See [LICENSE](LICENSE) for more information.
