# AGENTS.md — BlitzWallet

Guidance for AI coding agents working in this repository. Assumes no prior knowledge of the project.

## Project Overview

BlitzWallet is a free, open-source, self-custodial Bitcoin and Lightning wallet for iOS and Android, built with React Native and Expo. Users control their own 12-word BIP39 seed phrase; there is no KYC and no custodial service. Payments run primarily on the [Spark](https://spark.info) Layer 2 network, with additional support for Lightning (via Breez Liquid SDK), Liquid, Rootstock, Boltz swaps, LNURL, Nostr Wallet Connect (NWC), stablecoins (USDB/USDT/USDC), and merchant/POS tools. Backend services (contacts, messaging, notifications, gifts, pools) use Firebase. The app is localized into 8 languages.

- License: Apache 2.0 (`LICENSE`)
- Public repo: https://github.com/BlitzWallet/BlitzWallet
- `app.json` version: `0.2.7`; releases are tagged per platform (e.g. `Android-v0.7.10-pre4`, `Spark-v0.0.7-beta`)

## Tech Stack

- **React Native 0.81.4** + **Expo ~54** (bare workflow — native `android/` and `ios/` projects are checked in; built with `react-native run-*`, not `expo run`)
- **React 19.1**, JavaScript (ES modules) with some TypeScript (`.ts`/`.tsx`, e.g. `App.tsx`); `tsconfig.json` extends `@react-native/typescript-config` but there is no `tsc` script — type-checking is not enforced in CI
- **Yarn 3.6.4** (node-modules linker, Corepack), Node >= 20
- Key SDKs: `@buildonspark/spark-sdk` (+ `spark-web-context` from a GitHub commit), `@breeztech/react-native-breez-sdk-liquid`, `@flashnet/sdk` (BTC↔stablecoin swaps), `boltz-core`, `nostr-tools`, `ethers`, `@scure/bip32`/`bip39`, `@noble/hashes`/`secp256k1`
- **Firebase** via `@react-native-firebase/*` (auth, Firestore, functions, messaging, crashlytics, storage) — see `db/` and `firebase.json`
- Navigation: `@react-navigation` v7 (native-stack, drawer, bottom-tabs, pager-view)
- State: React Context only (no Redux/Zustand) — a deeply nested provider tree in `App.tsx` backed by `context-store/*`
- UI: custom themed components + `react-native-reanimated` v4, `react-native-worklets`, `lottie`, `react-native-svg`, vision-camera, maps, webview
- i18n: `i18next` + `react-i18next`, static JSON in `locales/<lang>/translation.json`

## Repository Layout

- `App.tsx` — app entry; composes the global Context provider tree (order matters — providers consume each other's hooks) and the root `NavigationContainer`
- `index.js` — JS entry point: loads `pollyfills.js`, `disableFontScalling.js`, `i18n.js`, registers the App and `index.background.js`
- `index.background.js` — headless background-notification handler (Firebase messaging + expo-task-manager). Deliberately contains **no** App component or Context providers — keep it that way
- `app/` — application code
  - `app/functions/` — business logic, organized by domain: `spark/` (largest module: payments, transactions, restore, Flashnet swaps, spend-and-replace), `sendBitcoin/`, `receiveBitcoin/`, `boltz/`, `breezLiquid/`, `lnurl/`, `nwc/`, `contacts/`, `accounts/`, `messaging/`, `notifications/`, `pos/`, `pools/`, `savings/`, `gift/`, `lrc20/`, `webview/`, plus many single-file utilities
  - `app/screens/` — UI screens: `createAccount/` (onboarding), `inAccount/` (main app: home, send/receive, settings, POS, gifts, BTC map, analytics), plus debug screens (`boltzDebug.js`, `breezSparkTest.js`)
  - `app/components/`, `app/hooks/`, `app/constants/` (theme, styles, math, icons), `app/assets/`
- `context-store/` — ~35 React Context providers (theme, keys, auth, spark wallet, contacts, NWC, flashnet, pools, savings, POS, balances, notifications, webview, etc.)
- `navigation/` — stack/drawer/tab navigators (`GiftsStack`, `POSStack`, `PoolsStack`, `SavingsStack`, …) and `navigationService.tsx`
- `db/` — Firebase init (`initializeFirebase.js`) and Firestore access layer (`index.js`, `handleBackend.js`); user-facing data is encrypted via `app/functions/messaging/encodingAndDecodingMessages.js`
- `locales/` — translation JSON per language (`en` is the source of truth) and `localeslist.js`; contribution guide in `locales/how_to_contribute.md`
- `__tests__/` — Jest tests, mirroring source layout (`functions/`, `context-store/`, `screens/`, plus flat files)
- `patches/` — `patch-package`-style patches for native/JS deps (`@noble/*`, ecpair, pbkdf2, Lottie, LWK) — see `patches/breezSDK.md` for the manual Breez SDK Kotlin edit
- `docs/` — design docs and plans (`docs/plans/`, `docs/superpowers/`)
- `android/`, `ios/` — checked-in native projects
- `CLAUDE.md` — working-agreement rules for AI agents (see "Working Conventions" below); `CVE_AUDIT_REPORT.md` — dependency security audit (2026-07-19)
- `CLAUDE-SECURITY-*/` — artifacts of past automated security runs; not part of the app

## Build and Run Commands

All commands are Yarn scripts (`package.json`); install deps with `yarn install` (Corepack enabled). iOS additionally requires `pod install` in `ios/`.

- `yarn start` — start Metro bundler
- `yarn android` / `yarn ios` — build and run on device/emulator
- `yarn android:clean` — `./gradlew clean` then run
- `yarn lint` — ESLint over the repo (the only CI check)
- `yarn test` — Jest
- `yarn apkBuild` / `yarn apkBuild:clean` — Android release APK (`./gradlew assembleRelease`)
- `yarn playstoreBuild` — Play Store bundle (`./gradlew bundleRelease`)
- `yarn build-android` / `yarn build-ios` — RN CLI build
- `yarn depCheck` — `depcheck` for unused dependencies

No Fastlane/CocoaPods-level scripts live at the root beyond the `Gemfile`; app-store deployment is manual. `zapstore.yaml` declares metadata for Zapstore distribution.

## Testing

- Framework: **Jest 29** with the `react-native` preset, tests in `__tests__/**/*.test.js`
- `jest.config.js`: `transformIgnorePatterns` whitelists the ESM packages that must go through babel-jest (`@noble`, `@buildonspark/spark-sdk`, `@react-navigation`, Firebase, …). If a test imports another untranspiled ESM dependency, add it to the `esModules` list there
- `.worktrees/` is excluded from Jest to avoid haste collisions
- `jest.setup.js` runs before every test and globally mocks all `@react-native-firebase/*` modules, `react-native-localize`, and `react-native-quick-crypto` (delegating to `node:crypto` so encryption code actually works under Jest). Individual tests override these with local `jest.mock(...)` when they need return values
- Tests are plain unit/integration tests of pure logic (payments parsing, hooks, contexts); there is no E2E harness and `yarn test` is **not** run in CI — run it locally when touching logic: `yarn test` (or `yarn test <pattern>`)

## Code Style

- Prettier (`.prettierrc.js`): single quotes, trailing commas everywhere, `arrowParens: 'avoid'`
- ESLint (`.eslintrc.js`) extends `@react-native` with many rules relaxed (`no-inline-styles`, `curly`, `react-hooks/exhaustive-deps`, `quotes` off; `no-unused-vars` off but `no-undef` is an error). Hermes-native globals (`BigInt`, `Buffer`, `atob`, `structuredClone`, …) are declared there
- Conventions in practice: function components, `useMemo`/`useCallback` around context values, camelCase files (mixed `.js`/`.jsx`-less style), domain-based folders under `app/functions/`, constants centralized in `app/constants/index.js`
- Babel (`babel.config.js`): `babel-preset-expo`, `react-native-dotenv`, module-resolver aliases (`crypto` → `react-native-quick-crypto`, `stream` → `stream-browserify`, `buffer` → `@craftzdog/react-native-buffer`), `transform-remove-console` in production, and `react-native-worklets/plugin` **must stay last**
- Metro (`metro.config.js`): extensive Node-polyfill shims required by the Spark/crypto stack (`ws` → `ws-shim.js`, `net`/`tls` → `react-native-tcp-socket`, most other Node core modules → `empty-module.js`). Do not remove these without testing a full app boot

## Configuration, Secrets, and Security

- Runtime config comes from a **`.env` file at the repo root**, loaded via `react-native-dotenv` and read as `process.env.*` (e.g. `BOLTZ_ENVIRONMENT`, `LIQUID_BREEZ_KEY`, `SPARK_IDENTITY_PUBKEY`, `BACKEND_PUB_KEY`, `DEVICE_IP`). `.env` is gitignored — never commit it; the app will not run correctly without one
- Firebase is configured through native files (`GoogleService-Info.plist` / `google-services.json`); Crashlytics settings in `firebase.json`
- The seed phrase and keys live in `expo-secure-store` (`app/functions/secureStore.js`); general persistence is AsyncStorage (`app/functions/localStorage.js`) and `expo-sqlite` (Spark transaction cache in `app/functions/spark/transactions.js`)
- Security rules: never log seed phrases/private keys; Firestore-bound user data is encrypted client-side; keep PIN/biometric paths (`context-store/authContext.js`, `app/functions/biometricAuthentication.js`) intact; production builds strip `console.*`
- `patches/` are applied to `node_modules` — check them before upgrading the patched dependency

## Working Conventions (from CLAUDE.md)

The repo's `CLAUDE.md` defines binding working rules for AI agents — in short:

1. **Think before coding** — state assumptions, surface tradeoffs, ask when unclear rather than picking silently
2. **Simplicity first** — minimum code that solves the problem; no speculative features, abstractions, or configurability
3. **Surgical changes** — touch only what the request requires; match existing style; don't refactor or "improve" adjacent code; remove only dead code your own changes orphaned; mention (don't delete) pre-existing dead code
4. **Goal-driven execution** — turn tasks into verifiable goals (write the failing test first, then make it pass) and loop until verified

## CI and Releases

- CI: single GitHub Actions workflow `.github/workflows/ci.yml` on macOS, Node 20 + Corepack, `yarn install` (with retry) then `yarn lint` — that is the entire gate
- Releases: tagged per platform on GitHub; Android release artifacts built via the `apkBuild`/`playstoreBuild` scripts above; `docs/plans/` and `docs/superpowers/` hold past design docs useful for context on chart/analytics and transaction-filtering work
