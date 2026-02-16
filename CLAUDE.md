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

## Testing

- **Framework**: Jest 29.7 with `react-native` preset
- **Config**: `jest.config.js`
- **Test location**: `__tests__/`
- **Run**: `yarn test`
