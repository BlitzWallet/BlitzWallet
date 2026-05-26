<img src=".github/assets/images/wordmark.png" alt="Blitz Wallet" width="100%">

<hr/>

Blitz Wallet is a free, open-source, self-custodial Bitcoin and Lightning wallet built with React Native and Expo. It is designed for everyday Bitcoin use: users control their own 12-word seed phrase, no KYC is required, and Blitz does not custody user funds.

Blitz is powered by the [Spark](https://spark.info) Layer 2 network for instant, low-fee Bitcoin payments without channel management or node maintenance. The product is available on iOS, Android.

<hr>

> **Self-Custodial** - Neither Blitz nor Spark has access to your seed phrase or funds. If you lose your seed phrase, access to your funds can be lost. Do not share your seed phrase with anyone.

## Download

[![Google Play](.github/assets/images/google-play.svg)](https://play.google.com/store/apps/details?id=com.blitzwallet)
[![iOS App Store](.github/assets/images/app-store.svg)](https://apps.apple.com/us/app/blitz-wallet/id6476810582)

## Features

### Payments and Transfers

- **Account-based payments** - send Bitcoin to Blitz contacts or usernames without manually handling QR codes, invoices, or addresses.
- **Free Blitz-to-Blitz transfers** - send between Blitz users with no Blitz transaction fee.
- **Send Bitcoin** - pay from QR code, camera roll, clipboard, contacts, manual entry, Lightning address, LNURL, BOLT11, USDT, USDC, Liquid, Spark, and supported Bitcoin payment links.
- **Receive Bitcoin** - generate Lightning, Spark, on-chain Bitcoin, Liquid, and Rootstock receive options.
- **Offline receive** - receive supported Spark/Lightning payments even when the recipient's device is not online.
- **Stablecoin payments** - send and receive USDB and other Spark tokens, with USDB displayed as a dollar balance.
- **LNURL support** - pay, withdraw, and auth flows.
- **Bulk and split payments** - send to multiple recipients or split a payment across available balances.
- **Pay links** - create reusable payment request links with optional amounts and descriptions.
- **Lightning Address** - receive to a Blitz-managed `@blitzwalletapp.com` Lightning address.

### Savings and Goals

- **USDB savings goals** - create named savings goals, deposit or withdraw funds, and track progress in a USD-backed stablecoin balance.
- **Blitz Pools** - create collaborative funding pools, invite contributors, and track progress toward a shared target.
- **Accumulation addresses** - receive USDC or USDT on Solana, Base, Ethereum, Arbitrum, Optimism, Polygon, Tron, or Plasma and auto-convert to BTC or USDB.
- **Bitcoin/stablecoin swaps** - convert between BTC and USDB in-app through Flashnet liquidity.
- **Analytics and budgeting** - review income and spending charts, set budgets, and monitor budget limits.

### Wallet Management

- **Self-custodial recovery** - create or restore a wallet from a 12-word BIP39 seed phrase.
- **Sub-accounts** - create and manage multiple accounts under one wallet.
- **Contacts and profiles** - save contacts, profile images, notes, and payment details for faster repeat payments.
- **Transaction history** - review payment direction, type, status, fee, date, memo, payment hash, preimage, and technical IDs.
- **CSV export** - export transaction history.
- **Nostr Wallet Connect (NWC)** - create NWC accounts with scoped permissions, budgets, and Nostr app connectivity.

### Gifting and Merchant Tools

- **Blitz Gifts** - send claimable Bitcoin gifts to anyone, including people who do not have a Blitz account yet.
- **Bulk gifts** - create multiple gift links at once and reclaim expired gifts.
- **Point of Sale** - accept Lightning payments, track sales, collect tips, configure POS items, and manage merchant payout settings.
- **Bitrefill shop** - buy gift cards and digital services through the in-app Bitrefill integration.
- **BTC Map** - find nearby Bitcoin-accepting merchants on an interactive map.
- **Online listings** - browse Bitcoin-friendly businesses and listings.

### Settings and Security

- **PIN protection** - secure wallet access with a custom PIN.
- **Biometric login** - opt in to Face ID or fingerprint authentication.
- **Fast pay controls** - configure payment speed and confirmation preferences.
- **Fiat display** - choose from many fiat display currencies.
- **Balance denomination** - switch between fiat, sats, or hidden balances.
- **Themes** - Light, Dark, and Lights Out modes.
- **Push notifications** - receive payment and wallet event alerts.
- **Crash reporting controls** - manage diagnostic reporting from settings.

### Localization

Available in 8 languages: English, Spanish, French, German, Italian, Portuguese (Brazil), Swedish, and Russian.

## Release Notes

The public release history is maintained through [GitHub releases](https://github.com/BlitzWallet/BlitzWallet/releases) and [tags](https://github.com/BlitzWallet/BlitzWallet/tags). Recent local release tags include `Android-v0.7.10-pre4` and the Spark beta tag series through `Spark-v0.0.7-beta`; the app metadata currently reports version `0.2.7` in `app.json`.

## Contributing

We rely on GitHub for bug tracking. Before reporting a new bug, please search the [existing issues](https://github.com/BlitzWallet/BlitzWallet/issues) to see if it has already been reported. If not, feel free to create a new issue.

We welcome pull requests to improve the codebase or introduce new features. All pull requests will be reviewed by the Blitz team.

## Build

To run the project locally, follow these steps:

Coming soon...

## License

Blitz Wallet is released under the terms of the Apache 2.0 license. See [LICENSE](LICENSE) for more information.
