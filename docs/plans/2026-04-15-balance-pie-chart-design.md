# Balance Pie Chart — Design Doc

**Date:** 2026-04-15
**Branch:** analytics

## Summary

Replace the `PortfolioChart` (line chart) on the analytics homepage with a donut pie chart showing the user's Bitcoin vs Dollar portfolio balance breakdown. Savings balance is folded into the Dollar segment.

## Data Model

Two segments, normalised to the user's preferred denomination (`masterInfoObject.userBalanceDenomination`):

| Segment | Sats mode | Fiat mode |
|---|---|---|
| **Bitcoin** | `bitcoinBalance` (sats) | `bitcoinBalance / 1e8 * btcPrice` |
| **Dollar** | `dollarBalanceSat + dollarsToSats(savingsBalance, btcPrice)` | `dollarBalanceToken + savingsBalance` |

- `bitcoinBalance`, `dollarBalanceSat`, `dollarBalanceToken` — from `useUserBalanceContext()`
- `savingsBalance` (USD) — from `useSavings()`
- `btcPrice` — `poolInfo.currentPriceAInB` from `useFlashnet()`
- `userBalanceDenomination` — from `masterInfoObject` via `useGlobalContextProvider()`

Segments with a value of zero are hidden from both chart and legend.

**Empty state:** if total is zero, render a full-circle gray placeholder slice.

## Component

**File:** `app/functions/CustomElements/balancePieChart.js`

**Props:** none — pulls all data from context internally.

**Rendering stack:**
- `PolarChart` + `PieChart` from `victory-native` (already installed, v41)
- `innerRadius="60%"` for donut shape
- Canvas size: ~200×200, centred
- Center label: total balance via `displayCorrectDenomination`

**Colors:**
- Bitcoin: `COLORS.bitcoinOrange` (#FFAC30)
- Dollar: `COLORS.primary` (#0375F6)
- Empty: `COLORS.gray2`

## Legend

Single card below the donut, styled identically to the budget/metric cards on the analytics page:

- `backgroundOffset` background, `borderRadius: 16`, `padding: 16`
- Two rows separated by a 1px `backgroundColor` divider
- Each row: 10×10 `borderRadius: 4` color swatch · asset name (smedium, opacity 0.6) · amount (medium, fontWeight 500, flex right) · percentage (smedium, opacity 0.4, fixed ~45px column)
- Uses `ThemeText` for all text

## Analytics Page Changes

- Remove `PortfolioChart` import
- Remove `dailyBalances` state, `buildDailyBalances` import, and the `dailyBalances`-building logic inside the `useEffect` (keep the income/spent tx loading)
- Remove the delta row (`deltaBalanceSats`, `deltaPercent`, `deltaDisplay`, `deltaSign`, `deltaColor` calculations and JSX)
- Remove the `portfolioBalance` header text (the total balance is now shown inside the donut centre)
- Replace the entire `portfolioHeader` block with `<BalancePieChart />`
- Add imports for `useUserBalanceContext`, `useSavings`, `BalancePieChart`
