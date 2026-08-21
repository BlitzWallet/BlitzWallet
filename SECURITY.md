# Security Policy

Blitz is a self-custodial Bitcoin/Lightning wallet built on the Spark Layer 2 network. Vulnerabilities in Blitz can put user funds and privacy at risk, and we take every report seriously.

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues, discussions, or social media.

Instead, email us at `security@blitzwalletapp.com`.

Please avoid including seeds, private keys, or other credentials in your report. If your report contains sensitive details, we will provide an encrypted channel upon first contact.

### What to include

To help us triage and resolve the issue quickly, please include as much of the following as you can:

- A description of the vulnerability and its potential impact
- Step-by-step instructions to reproduce the issue
- The affected version(s) of Blitz and your platform (Android/iOS)
- The payment method or system in use (e.g. Spark, Lightning, on-chain Bitcoin, Liquid, USDB/USDC/USDT, Flashnet swap, Nostr Wallet Connect, Blitz Gifts, accumulation address)
- Any proof-of-concept code, logs, or screenshots (please redact seeds, private keys, and other credentials)
- Whether the issue has been disclosed anywhere else

### What to expect

- We will acknowledge your report within 7 days and keep you informed as we investigate
- We will work with you to understand and validate the issue
- Once a fix is released, we are happy to credit you for the discovery if you would like
- We ask that you give us a reasonable amount of time to address the issue before any public disclosure, and that you avoid actions that put user funds or data at risk while researching

## Scope

Reports of particular interest include:

- Loss or theft of user funds
- Exposure of seeds, private keys, or other credentials
- Bypass of PIN or biometric protections
- Payment, invoice, or swap handling flaws (overpayment, amount manipulation, fake payment confirmation)
- Gift and pay-link abuse (expired or reclaimed gift links, unclaimed balance exposure)
- Vulnerabilities in Blitz-operated or partner infrastructure users depend on (Spark network, Flashnet liquidity, Lightning address infrastructure)
- Issues in third-party dependencies (Spark SDK, Breez Liquid SDK, Lightning, etc.) should be reported upstream to the respective projects, though we appreciate a heads-up if Blitz is affected

## Supported Versions

Only the latest release of Blitz is supported with security updates. Please make sure you are running the most recent version, and update before reporting if possible.
