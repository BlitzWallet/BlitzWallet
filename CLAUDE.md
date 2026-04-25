# CLAUDE.md - BlitzWallet

## Project Overview

BlitzWallet is a self-custodial Bitcoin Lightning wallet built with React Native (0.81.4) and Expo (~54.0). It targets iOS and Android, written in TypeScript/JavaScript.

## Commands

```bash
yarn start              # Start Metro bundler
yarn android            # Run on Android device/emulator
yarn ios                # Run on iOS simulator
yarn test               # Run Jest tests
yarn lint               # Run ESLint
yarn apkBuild           # Build release APK
yarn apkBuild:clean     # Clean + build release APK
yarn playstoreBuild     # Build AAB for Play Store
yarn android:clean      # Clean + run Android
```

Requires Node >= 20. Uses Yarn as package manager.

## Project Structure

```
app/
  components/           # Login/onboarding components
  constants/            # Theme, icons, regex patterns, app constants
  functions/            # Core business logic
    CustomElements/     # Reusable UI components (buttons, modals, QR codes)
    boltz/              # Atomic swap functionality
    breezLiquid/        # Liquid Network integration
    spark/              # Spark SDK integration
    sendBitcoin/        # Send payment logic
    receiveBitcoin/     # Receive payment logic
    lnurl/              # LNURL protocol handling
    nwc/                # Nostr Wallet Connect
    pos/                # Point of Sale
    contacts/           # Contact management
  hooks/                # Custom React hooks
  screens/              # Screen components
    createAccount/      # Onboarding flow (PIN, mnemonic, restore)
    inAccount/          # Main app screens (send, receive, settings, etc.)
context-store/          # React Context providers (30+ contexts)
navigation/             # React Navigation setup (stack, tabs, drawer)
db/                     # Database layer (Firebase, SQLite, AsyncStorage)
locales/                # i18n translations (en, es, fr, de, it, pt-BR, ru, sv, ko)
patches/                # Yarn dependency patches
__tests__/              # Jest test files
```

## Code Conventions

- **Prettier**: single quotes, trailing commas (`all`), no parens on single arrow params
- **ESLint**: `@react-native` preset, `no-undef` enforced (error), inline styles allowed
- **State management**: React Context API (not Redux) - contexts live in `context-store/`
- **Navigation**: React Navigation v7 (native-stack, bottom-tabs, drawer)
- **Globals available**: `BigInt`, `Buffer`, `btoa`, `atob`, `TextDecoder`, `TextEncoder`

## Key Technologies

- **Lightning/Bitcoin**: Spark SDK, Breez SDK (Liquid), Boltz (atomic swaps), LNURL, bolt11
- **Blockchain**: liquidjs-lib, ethers (Rootstock), noble/secp256k1, BIP32/BIP39
- **Nostr**: nostr-tools, Nostr Wallet Connect (NWC)
- **Firebase**: Auth, Firestore, Cloud Functions, Messaging (FCM), Crashlytics
- **Local storage**: expo-sqlite, AsyncStorage, expo-secure-store
- **UI**: lucide-react-native (icons), lottie-react-native (animations), react-native-reanimated

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
