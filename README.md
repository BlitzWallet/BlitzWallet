<img src=".github/assets/images/wordmark.png" alt="Project Logo" width="100%">

<hr/>

Blitz Wallet is a React Native application that allows users to interact with the Bitcoin Lighting Network in a self-custodial way. Combining Breez, Boltz, and Blockstream, Blitz Wallet aims to create a seamless and simple payment experience for its users.

<hr>

⚠️ This is a SELF-CUSTODIAL Bitcoin Lightning wallet. Neither Blitz, Boltz, or Blockstream has access to your seed phrase or funds. If you lose your seed phrase, access to your funds will be lost. Also, do not share your seed phrase with anyone. If you do, they will be able to steal your funds.

## How it works

<img src=".github/assets/images/BlitzArchitecture.png" alt="How blitz wallet works" width="100%">

## Features

- Send Bitcoin payments
  - From QR code
  - From camera roll
  - From clipboard
  - From contacts
- Receive Bitcoin payments
  - Using a Lightning QR code
  - Using a Bitcoin QR Code
  - Using a Liquid QR Code
  - Using a Cashu eCash QR Code
- LNURL pay, withdrawal, and auth support
- Wallet recovery
- Support for numerous fiat currencies
- Export transactions in a CSV file
- View a detailed description of payments (date, time fee, payment type) + technical details (payment hash, payment preimage, payment ID)
- Change balance denomination between Fiat, Sats, or hidden
- Opt-in Biometric login
- Dark mode, Light mode, and Lights out mode
- Easy left slide QR code scanning on the wallet page
- Built in store where you can purchase gift cards, vpns, generative AI, and SMS messages

## TODO

- [x] Migrate from local storage to Google Firebase
- [x] Contacts
- [ ] Translation option
- [x] Be able to send to a Bitcoin address from Lightning balance and also a Liquid address from Lightning balance
- [x] Gift wallet feature
- [x] Savings account option
- [x] Suggested words when restoring the wallet
- [x] migrate from expo 49 to 51
- [x] Split bill option in contacts
- [x] Giveaway feature in contacts
- [x] Integrate Bitcoin Liquid Wallet
- [x] Have channels auto-rebalance to and from liquid
- [x] Smart channel openings using liquid
- [x] Be able to send money from your liquid wallet to a Lightning address
- [x] Be able to receive money to a liquid wallet from a lightning or liquid payment if the amount is over inbound capacity
- [x] Add apps to store

## Download Blitz Wallet

[![Google Play](.github/assets/images/google-play.svg)](https://play.google.com/store/apps/details?id=com.blitzwallet)
[![TestFlight](.github/assets/images/app-store.svg)](https://testflight.apple.com/join/r8MfbNa6)

## Contribute

We rely on GitHub for bug tracking. Before reporting a new bug, please take a moment to search the <a href='https://github.com/BlitzWallet/BlitzWallet/issues'>existing issues</a> to see if your problem has already been addressed. If you can't find an existing report, feel free to create a new issue.

Moreover, we encourage contributions to the project by submitting pull requests to improve the codebase or introduce new features. All pull requests will be thoroughly reviewed by members of the Blitz team. Your contributions are invaluable to us!

## Build

To run the project locally, follow these steps:

Coming soon...

## License

Blitz is released under the terms of the Apache 2.0 license. See LICENSE for more information.
