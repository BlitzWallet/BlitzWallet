# Portfolio Value Chart — Analytics Page

## Overview

Add a portfolio value chart to the top of `analyticsPage.js`, above the income/spent row. Mirrors the Cash App / Robinhood style shown in the reference screenshot.

## Data Model

**Source data:**
- `sparkInformation.balance` — current wallet balance in sats
- `fiatStats` — current BTC price (used for all daily conversions)
- `getMonthlyTransactions(identityPubKey)` — all INCOMING + OUTGOING transactions for the current month, each with a `time` field inside `details` JSON

**Daily balance reconstruction:**
1. Fetch all transactions for the current month (both directions).
2. Group transactions by calendar day.
3. Walk backwards from `sparkInformation.balance` through each day's net flow (`incoming - outgoing`) to produce a `dailyBalances` array: one sats value per day from day 1 through today.
4. Convert each entry to the user's preferred denomination using the current `fiatStats` price via `displayCorrectDenomination`.

**Displayed values:**
- **Big number**: current balance — `displayCorrectDenomination({ amount: sparkInformation.balance, ... })`
- **Delta**: `(todayBalance - day1Balance)` in sats, converted at today's rate. Show as `+$X.XX (+X.XX%)` or `-$X.XX (-X.XX%)`. Green if positive, red if negative.
- **Chart data**: array of `{ day: number, balanceSats: number }` — one entry per elapsed day.

## Chart Component

**Name:** `PortfolioChart`
**Location:** `app/functions/CustomElements/portfolioChart.js`

**Props:**
```js
{
  dailyBalances: Array<{ day: number, balanceSats: number }>,
  fiatStats: object,
  masterInfoObject: object,
}
```

**Rendering:**
- SVG via `react-native-svg`
- Smooth curve via `d3-shape` `line()` with `curveCatmullRom` interpolation
- Scale axes via `d3-scale` `scaleLinear`
- Gradient fill beneath the line using `<Defs>` + `<LinearGradient>` — green tint matching `COLORS.primary`, fading to transparent at the bottom
- No axis labels or grid lines — clean, minimal
- Height: ~120px, width: `WINDOWWIDTH`

**Edge cases:**
- 0 or 1 data point: render a flat horizontal line at the single value (or zero)
- All balances are 0: flat line at zero

## Layout in `analyticsPage.js`

Inserted inside the ScrollView content, above the income/spent `metricsRow`:

```
┌─────────────────────────────────┐
│  $74,022.63                     │
│  +$763.48  +1.04%  ↑            │
│  ~~~~ SVG line chart ~~~~       │
└─────────────────────────────────┘

[ Income ]  [ Spent ]

Budget
...
```

The chart block sits directly in the scroll content with no card wrapper — the numbers and chart render flush, matching the reference design.

## Loading State

While `isLoading` is true, render an `ActivityIndicator` (color `COLORS.darkModeText`) centered in the chart area (same ~120px height), consistent with the income/spent card loading behavior.

## No New Dependencies

Uses only what is already installed:
- `react-native-svg` (15.12.1)
- `d3-shape` (^3.2.0)
- `d3-scale` (^4.0.2)
