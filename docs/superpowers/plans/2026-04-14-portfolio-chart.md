# Portfolio Value Chart Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Cash App–style portfolio value chart to the top of `analyticsPage.js`, showing daily sats balance reconstructed from transaction history, displayed in the user's preferred denomination.

**Architecture:** A pure `buildDailyBalances` helper reconstructs one balance-per-day by walking backwards from the current balance through this month's transactions. A lean `PortfolioChart` SVG component (no labels, gradient fill) renders those values. `analyticsPage.js` wires them together, showing the big balance, delta, and chart above the income/spent row.

**Tech Stack:** `react-native-svg`, `d3-shape` (curveCatmullRom + area), `d3-scale` (scaleLinear) — all already installed.

---

## Chunk 1: `buildDailyBalances` helper

### Task 1: Add and test `buildDailyBalances` in transactions.js

**Files:**
- Modify: `app/functions/spark/transactions.js` — export `buildDailyBalances(allTxs, currentBalanceSats, referenceDate?)`
- Test: `__tests__/functions/spark/transactions.test.js`

The function accepts all this month's transactions (both directions, each row has a `details` JSON string with `{ time, amount, direction }`), the current wallet balance in sats, and an optional `referenceDate` (defaults to `new Date()`) for testability. It returns `Array<{ day: number, balanceSats: number }>` — one entry per elapsed day from day 1 through today, in ascending order.

**Algorithm:**
1. Parse each tx's `details`, extract `time` (ms timestamp), `amount` (sats), `direction` (`'INCOMING'`/`'OUTGOING'`).
2. Group net sats change per calendar day: `+amount` for INCOMING, `-amount` for OUTGOING.
3. Start at `currentBalanceSats`. Walk backwards from `today` down to `1`, prepending `{ day, balanceSats: balance }` and subtracting that day's net delta each step.

- [ ] **Step 1: Write failing tests**

Add a new `describe('buildDailyBalances')` block to `__tests__/functions/spark/transactions.test.js`:

```js
import {
  buildFilterQuery,
  buildDailyBalances,
  SPARK_TRANSACTIONS_TABLE_NAME,
} from '../../../app/functions/spark/transactions';

describe('buildDailyBalances', () => {
  // Helper: build a fake tx row
  const makeTx = (day, amount, direction, month = 3, year = 2026) => ({
    details: JSON.stringify({
      time: new Date(year, month - 1, day, 12).getTime(),
      amount,
      direction,
    }),
  });

  const REF = new Date(2026, 2, 15, 18); // March 15, 2026

  it('returns one entry per day from 1 to today', () => {
    const result = buildDailyBalances([], 1000, REF);
    expect(result).toHaveLength(15);
    expect(result[0].day).toBe(1);
    expect(result[14].day).toBe(15);
  });

  it('all balances equal currentBalance when no transactions', () => {
    const result = buildDailyBalances([], 5000, REF);
    result.forEach(({ balanceSats }) => expect(balanceSats).toBe(5000));
  });

  it('subtracts incoming tx from earlier days to reconstruct past balance', () => {
    // Received 200 sats on day 10; balance before day 10 should be 800
    const txs = [makeTx(10, 200, 'INCOMING')];
    const result = buildDailyBalances(txs, 1000, REF);
    const day10 = result.find(r => r.day === 10);
    const day9 = result.find(r => r.day === 9);
    expect(day10.balanceSats).toBe(1000); // today's balance unchanged
    expect(day9.balanceSats).toBe(800);   // before the incoming tx
  });

  it('adds back outgoing tx from earlier days to reconstruct past balance', () => {
    // Spent 300 sats on day 5; balance before day 5 should be 1300
    const txs = [makeTx(5, 300, 'OUTGOING')];
    const result = buildDailyBalances(txs, 1000, REF);
    const day4 = result.find(r => r.day === 4);
    expect(day4.balanceSats).toBe(1300);
  });

  it('handles multiple txs on the same day', () => {
    const txs = [
      makeTx(8, 500, 'INCOMING'),
      makeTx(8, 100, 'OUTGOING'),
    ];
    // Net on day 8: +400. Before day 8 balance = 1000 - 400 = 600
    const result = buildDailyBalances(txs, 1000, REF);
    const day7 = result.find(r => r.day === 7);
    expect(day7.balanceSats).toBe(600);
  });

  it('skips rows with unparseable details without throwing', () => {
    const txs = [{ details: 'not-json' }, makeTx(3, 50, 'INCOMING')];
    expect(() => buildDailyBalances(txs, 500, REF)).not.toThrow();
  });

  it('returns a single entry on the first of the month', () => {
    const firstOfMonth = new Date(2026, 2, 1, 10);
    const result = buildDailyBalances([], 999, firstOfMonth);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ day: 1, balanceSats: 999 });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn test __tests__/functions/spark/transactions.test.js
```

Expected: `buildDailyBalances is not a function` or similar import error.

- [ ] **Step 3: Implement `buildDailyBalances` in transactions.js**

Add to the bottom of `app/functions/spark/transactions.js` (before the final export block if one exists, otherwise just append):

```js
/**
 * Reconstruct daily closing balances for the current calendar month.
 *
 * @param {Object[]} allTxs - All month's transactions (both INCOMING and OUTGOING).
 *   Each row must have a `details` JSON string with `{ time, amount, direction }`.
 * @param {number} currentBalanceSats - Current wallet balance in sats.
 * @param {Date} [referenceDate=new Date()] - Used to determine today's day-of-month.
 * @returns {Array<{ day: number, balanceSats: number }>} One entry per day, day 1 → today.
 */
export function buildDailyBalances(allTxs, currentBalanceSats, referenceDate = new Date()) {
  const today = referenceDate.getDate();

  // Build map of day → net sats delta for that day
  const dayDeltas = {};
  for (const tx of allTxs) {
    try {
      const details = JSON.parse(tx.details);
      const day = new Date(details.time).getDate();
      const amount = details.amount || 0;
      const delta = details.direction === 'INCOMING' ? amount : -amount;
      dayDeltas[day] = (dayDeltas[day] || 0) + delta;
    } catch {
      // skip unparseable rows
    }
  }

  // Walk backwards from today, prepending each day's closing balance
  const result = [];
  let balance = currentBalanceSats;
  for (let day = today; day >= 1; day--) {
    result.unshift({ day, balanceSats: balance });
    balance -= dayDeltas[day] || 0;
  }
  return result;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
yarn test __tests__/functions/spark/transactions.test.js
```

Expected: All tests pass including the new `buildDailyBalances` describe block.

- [ ] **Step 5: Commit**

```bash
git add app/functions/spark/transactions.js __tests__/functions/spark/transactions.test.js
git commit -m "feat: add buildDailyBalances helper for portfolio chart"
```

---

## Chunk 2: `PortfolioChart` component

### Task 2: Create the SVG chart component

**Files:**
- Create: `app/functions/CustomElements/portfolioChart.js`

This is a pure visual component: no labels, no grid, no axes. Just a smooth gradient-filled line with a dot at the last point. Modeled after the existing `modernLineChart.js` but stripped to essentials.

Props:
```js
{
  data: number[],        // sats values, one per day, ascending
  width: number,
  height: number,
  strokeColor: string,   // pass COLORS.primary
}
```

- [ ] **Step 1: Create `portfolioChart.js`**

```js
import Svg, { Defs, LinearGradient, Stop, Path, Circle } from 'react-native-svg';
import * as d3 from 'd3-shape';
import * as scale from 'd3-scale';

export default function PortfolioChart({ data, width, height, strokeColor }) {
  if (!data || data.length < 2) {
    // Flat line for 0 or 1 data points
    const y = height / 2;
    return (
      <Svg width={width} height={height}>
        <Path
          d={`M 0 ${y} L ${width} ${y}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          strokeOpacity={0.4}
        />
      </Svg>
    );
  }

  const padding = { top: 8, bottom: 8, left: 0, right: 0 };

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  // Add small buffer so curve doesn't clip at edges
  const range = maxVal - minVal || 1;
  const buffer = range * 0.15;

  const xScale = scale
    .scaleLinear()
    .domain([0, data.length - 1])
    .range([padding.left, width - padding.right]);

  const yScale = scale
    .scaleLinear()
    .domain([minVal - buffer, maxVal + buffer])
    .range([height - padding.bottom, padding.top]);

  const lineGenerator = d3
    .line()
    .x((_, i) => xScale(i))
    .y(d => yScale(d))
    .curve(d3.curveCatmullRom.alpha(0.5));

  const areaGenerator = d3
    .area()
    .x((_, i) => xScale(i))
    .y0(height - padding.bottom)
    .y1(d => yScale(d))
    .curve(d3.curveCatmullRom.alpha(0.5));

  const linePath = lineGenerator(data) || '';
  const areaPath = areaGenerator(data) || '';

  const lastX = xScale(data.length - 1);
  const lastY = yScale(data[data.length - 1]);

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </LinearGradient>
      </Defs>

      {/* Gradient fill */}
      <Path d={areaPath} fill="url(#portfolioGradient)" />

      {/* Line */}
      <Path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dot at current (last) point */}
      <Circle cx={lastX} cy={lastY} r={6} fill={strokeColor} opacity={0.2} />
      <Circle cx={lastX} cy={lastY} r={3.5} fill={strokeColor} />
    </Svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/functions/CustomElements/portfolioChart.js
git commit -m "feat: add PortfolioChart SVG component"
```

---

## Chunk 3: Wire up `analyticsPage.js`

### Task 3: Add portfolio header to the analytics screen

**Files:**
- Modify: `app/screens/inAccount/analyticsPage.js`

**Changes:**
1. Import `buildDailyBalances` and `PortfolioChart`.
2. Add `dailyBalances` state (default `[]`).
3. In the existing `useEffect`, after computing `totalIn`/`totalOut`, call `buildDailyBalances([...inTxs, ...outTxs], sparkInformation.balance)` and set state.
4. Derive `deltaBalanceSats` and `deltaPercent` from `dailyBalances`.
5. Render the portfolio header block inside the `ScrollView` content, before the `metricsRow`.

- [ ] **Step 1: Add imports to `analyticsPage.js`**

At the top of the file, add:
```js
import { Dimensions } from 'react-native';
import PortfolioChart from '../../functions/CustomElements/portfolioChart';
import { buildDailyBalances } from '../../functions/spark/transactions';
```

Note: `Dimensions` goes into the existing `react-native` import destructure, not a separate line.

- [ ] **Step 2: Add `dailyBalances` state and chart width constant**

In the component, alongside the existing `useState` calls:
```js
const [dailyBalances, setDailyBalances] = useState([]);
```

Below the existing `const` declarations (near `backgroundOffset`, `backgroundColor`), add:
```js
const chartWidth = Dimensions.get('screen').width * 0.95;
```

- [ ] **Step 3: Compute and set dailyBalances in the useEffect**

Inside the `try` block in `load()`, after computing `totalIn`/`totalOut`, append:
```js
const allTxs = [...inTxs, ...outTxs];
const balances = buildDailyBalances(allTxs, sparkInformation.balance);
setDailyBalances(balances);
```

The full updated `load` function body:
```js
const [inTxs, outTxs] = await Promise.all([
  getMonthlyTransactions(sparkInformation.identityPubKey, 'INCOMING'),
  getMonthlyTransactions(sparkInformation.identityPubKey, 'OUTGOING'),
]);
const totalIn = inTxs.reduce((sum, tx) => {
  try { return sum + (JSON.parse(tx.details).amount || 0); } catch { return sum; }
}, 0);
const totalOut = outTxs.reduce((sum, tx) => {
  try { return sum + (JSON.parse(tx.details).amount || 0); } catch { return sum; }
}, 0);
setIncomeTotal(totalIn);
setSpentTotal(totalOut);
setIncomeTxCount(inTxs.length);
setSpentTxCount(outTxs.length);

const allTxs = [...inTxs, ...outTxs];
const balances = buildDailyBalances(allTxs, sparkInformation.balance);
setDailyBalances(balances);
```

- [ ] **Step 4: Derive delta values**

Below the existing derived values (after `budgetStatus`), add:
```js
const startBalanceSats = dailyBalances.length > 0 ? dailyBalances[0].balanceSats : sparkInformation.balance;
const currentBalanceSats = sparkInformation.balance;
const deltaBalanceSats = currentBalanceSats - startBalanceSats;
const deltaPercent = startBalanceSats > 0 ? (deltaBalanceSats / startBalanceSats) * 100 : 0;
const deltaIsPositive = deltaBalanceSats >= 0;

const deltaDisplay = displayCorrectDenomination({
  amount: Math.abs(deltaBalanceSats),
  masterInfoObject,
  fiatStats,
});
const deltaSign = deltaIsPositive ? '+' : '-';
const deltaColor = deltaIsPositive ? COLORS.primary : COLORS.cancelRed;
```

- [ ] **Step 5: Render the portfolio header section**

Inside the `ScrollView`'s `contentContainerStyle` View, before the `metricsRow` View, insert:

```jsx
{/* Portfolio value header */}
<View style={styles.portfolioHeader}>
  {isLoading ? (
    <View style={styles.portfolioLoadingContainer}>
      <ActivityIndicator color={COLORS.darkModeText} size="small" />
    </View>
  ) : (
    <>
      <ThemeText
        styles={styles.portfolioBalance}
        content={displayCorrectDenomination({
          amount: sparkInformation.balance,
          masterInfoObject,
          fiatStats,
        })}
      />
      <View style={styles.portfolioDeltaRow}>
        <ThemeText
          styles={[styles.portfolioDelta, { color: deltaColor }]}
          content={`${deltaSign}${deltaDisplay}  ${deltaSign}${Math.abs(deltaPercent).toFixed(2)}%`}
        />
      </View>
      <PortfolioChart
        data={dailyBalances.map(d => d.balanceSats)}
        width={chartWidth}
        height={120}
        strokeColor={COLORS.primary}
      />
    </>
  )}
</View>
```

- [ ] **Step 6: Add portfolio styles**

Add to the `StyleSheet.create` block:
```js
portfolioHeader: {
  marginBottom: 32,
},
portfolioLoadingContainer: {
  height: 170,
  alignItems: 'center',
  justifyContent: 'center',
},
portfolioBalance: {
  fontSize: SIZES.xxLarge,
  fontWeight: '600',
  textAlign: 'left',
  marginBottom: 4,
},
portfolioDeltaRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 16,
},
portfolioDelta: {
  fontSize: SIZES.medium,
  fontWeight: '500',
},
```

`SIZES.xxLarge = 32` (confirmed in `app/constants/theme.js:106`).

- [ ] **Step 7: Run the app and visually verify**

```bash
yarn ios
# or
yarn android
```

Navigate to the Analytics page. Verify:
- Big balance number shows current wallet value
- Delta row shows `+/-$X.XX  +/-X.XX%` in green/red
- Chart renders with gradient fill and dot at today's position
- While loading, `ActivityIndicator` shows in the chart area
- If only 1 day of data (on the 1st of the month), flat line renders without crashing

- [ ] **Step 8: Commit**

```bash
git add app/screens/inAccount/analyticsPage.js
git commit -m "feat: add portfolio value chart to analytics page"
```
