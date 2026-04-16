# Analytics Charts Redesign

**Date:** 2026-04-15  
**Branch:** analytics  
**Status:** Approved

## Overview

Three chart changes across the analytics screens:

1. **BalancePieChart** — migrate from victory-native to a custom SVG ring matching the `circularProgress.js` pattern
2. **AnalyticsIncomePage** — replace donut + categories with a cumulative line chart + scrubber
3. **AnalyticsSpentPage** — same as income page

---

## 1. BalancePieChart → Balance Ring

### What changes

Remove the victory-native `PolarChart`/`Pie` import from `app/functions/CustomElements/balancePieChart.js`. Replace with the SVG + Reanimated circle pattern from `app/components/admin/homeComponents/pools/circularProgress.js`.

### Ring behavior

| Element | Color | Meaning |
|---|---|---|
| Track (static 360° circle) | `COLORS.primary` | Dollar portion of balance |
| Animated arc | `COLORS.bitcoinOrange` | Bitcoin portion of balance |

- **Progress value:** `btcValue / (btcValue + dollarValue)` — clamped to [0, 1]
- **Size:** 200px diameter, strokeWidth 16
- **Animation:** `withTiming(600ms, Easing.out(Easing.cubic))` with 150ms initial delay on mount (same as circularProgress.js)
- **Center text:** total balance formatted via `displayCorrectDenomination` (sats) or fiat string — same logic as today
- **Empty state:** track filled with `COLORS.gray2` at 100%, no animated arc, center shows "No balance"

### Legend card

Unchanged — the Bitcoin / Dollar rows with amounts and percentages remain below the ring.

---

## 2 & 3. Income & Spent Pages — Cumulative Line Chart with Scrubber

### What's removed

- Inline `DonutChart` component
- `categoryBreakdown` useMemo
- `CATEGORY_COLORS` constant
- `categorize()` function
- All legend JSX

### Data pipeline

`getMonthlyTransactions` returns rows with `details` (JSON string). Each row has:
- `details.time` — ms timestamp
- `details.amount` — sats (integer)

Build cumulative data:
1. Parse each tx, extract `(dayOfMonth, amount)` pairs using `getSatsFromTx`
2. Group by day (1–N where N = today's day-of-month)
3. Sort ascending, compute running total per day
4. Produce array of `{ day: number, cumulative: number }` for days 1..today

### Chart layout

- **Dimensions:** `WINDOWWIDTH` wide, 160px tall
- **SVG elements:**
  - 2–3 horizontal ghost grid lines (dashed, low opacity)
  - Y-axis labels (left edge): 2–3 formatted values using `displayCorrectDenomination` / fiat based on `userBalanceDenomination`
  - X-axis labels: day 1, mid-month (~day 15), today
  - `Polyline` for the line: `COLORS.primary` (income), `COLORS.bitcoinOrange` (spent), strokeWidth 2
  - `Path` for area fill: same color at 15% opacity
  - Animated scrubber vertical line (`Line`) + dot (`Circle`) driven by Reanimated shared values
- **Empty / single-point state:** flat line at zero, "No data" label, scrubber hidden

### Header behavior

```
[idle]     Month total amount
           "This month"

[dragging] Day cumulative amount  ← updates live via runOnJS
           "Apr 12"              ← day label derived from scrubber position
```

### Scrubber implementation

- Wrap SVG in `GestureDetector` with a `Pan` gesture from `react-native-gesture-handler`
- `scrubberX` = `useSharedValue(-1)` (-1 = hidden/idle)
- On `onBegin`/`onChange`: clamp x to chart bounds → compute nearest day index → `runOnJS(setSelectedDay)(dayIndex)`
- On `onEnd`/`onFinalize`: `runOnJS(setSelectedDay)(null)` → header reverts to month total
- `useAnimatedProps` on scrubber `Line` and `Circle` read `scrubberX` directly (no JS bridge for position)
- `selectedDay` state (null | number) controls header display: null → month total, number → `cumulativeData[selectedDay].cumulative`

### Denomination handling

All displayed amounts pass through `displayCorrectDenomination({ amount, masterInfoObject, fiatStats })` when `userBalanceDenomination` is `'sats'` or `'hidden'`. For `'fiat'` denomination, format as currency string using `masterInfoObject.fiatCurrency`.

---

## Files Affected

| File | Change |
|---|---|
| `app/functions/CustomElements/balancePieChart.js` | Replace victory-native chart with SVG ring |
| `app/screens/inAccount/analyticsIncomePage.js` | Remove donut/categories, add cumulative line chart |
| `app/screens/inAccount/analyticsSpentPage.js` | Remove donut/categories, add cumulative line chart |

No new files needed. No new dependencies.

---

## Non-goals

- No animation on the line chart itself (just the scrubber and the ring)
- No historical months — current month only
- No category breakdown anywhere
