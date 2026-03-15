# ViewAllTxPage Filter Modal — Premium Redesign

**Date:** 2026-03-15
**Status:** Draft

## Context

The existing filter modal is a plain single-select radio list (pick one transaction type). Users cannot combine filters — e.g. "show only received Lightning transactions from the last 30 days". The redesign upgrades the modal to a multi-dimensional, combinable Airbnb-style filter sheet with three sections: Direction, Date Range, and Transaction Type. The top-bar filter icon gains a numbered badge + ring (like Airbnb) to surface when active filters are applied.

---

## 1. Filter State Shape

`currentFilter` in `ViewAllTxPage` changes from `{ item: string, searchUUID: string }` to:

```js
{
  directions: [],   // [] = All | ['sent'] | ['received'] | ['sent','received'] = All
  dateRange: null,  // null | '7d' | '30d' | '90d' | '1y'
  types: [],        // [] = All types | any subset of TYPE_KEYS
  searchUUID: '',
}
```

`hasActiveFilters` = `directions.length > 0 || dateRange !== null || types.length > 0`

Badge count = `directions.length + (dateRange ? 1 : 0) + types.length`

---

## 2. TxFilterHalfModal Component

**File:** `app/components/admin/homeComponents/homeLightning/txFilterHalfModal.js`

Full component rewrite. Holds a **draft** copy of the filter state locally. Nothing is applied until "Apply Filters" is tapped.

### Props

| Prop                      | Type       | Description                                                                                                                                                                               |
| ------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `currentFilter`           | `object`   | Currently applied filter `{ directions, dateRange, types }` — initialises draft                                                                                                           |
| `onSelectFilter`          | `function` | Called with the final filter object on Apply                                                                                                                                              |
| `handleBackPressFunction` | `function` | Closes the modal                                                                                                                                                                          |
| `setContentHeight`        | `function` | Called with `680` on mount to size the modal. The 3-section layout is taller than the previous list; 680 fits comfortably on iPhone SE (667px screen) in a scrollable half-modal context. |

### Layout (scrollable, sections separated by dividers)

**Header:** Centred title using key `screens.inAccount.viewAllTxPage.filterModalTitle` ("Filter Transactions"). No close button — modal has its own drag-to-close.

**Section 1 — Direction**

- Section label: `filterDirectionTitle` ("Direction")
- Two equal-width side-by-side cards:
  - Left: up-arrow icon (`ArrowUp` from lucide) + label `filterSent` ("Sent")
  - Right: down-arrow icon (`ArrowDown`) + label `filterReceived` ("Received")
- Each card is a `TouchableOpacity` that toggles its key in `draft.directions`.
- Active card: highlighted border (accent/primary color) + slightly elevated background.
- Inactive card: muted border, default background.
- Both deselected = All directions.

**Divider**

**Section 2 — Date Range**

- Section label: `filterDateTitle` ("Date Range")
- Wrapping row of four pill chips (single-select, deselectable):
  - `filterDate7d` ("Last 7 days")
  - `filterDate30d` ("Last 30 days")
  - `filterDate90d` ("Last 90 days")
  - `filterDate1y` ("This year")
- Tapping a selected chip deselects it (sets `draft.dateRange = null`).
- Active chip: solid accent background, light text.
- Inactive chip: border only.

**Divider**

**Section 3 — Transaction Type**

- Section label: `filterTypeTitle` ("Transaction Type")
- Wrapping pill grid, multi-select:
  - `Lightning`, `Bitcoin`, `Spark`, `Contacts`, `Gifts`, `Swaps`, `Savings`, `Pools`
- Each pill toggles its key in/out of `draft.types`.
- Active pill: solid accent background, light text.
- Inactive pill: border only.

**Sticky Bottom Bar**

- Left: `ThemeText` "Clear All" (`filterClearAll`) — resets draft to `{ directions: [], dateRange: null, types: [] }`, does NOT close or apply.
- Right: filled `TouchableOpacity` button "Apply Filters" (`filterApply`) — calls `onSelectFilter(draft)` then `handleBackPressFunction()`.
- Background matches modal background, with top border separator.

---

## 3. ViewAllTxPage Changes

**File:** `app/screens/inAccount/viewAllTxPage.js`

### State

```js
const [currentFilter, setCurrentFilter] = useState({
  directions: [],
  dateRange: null,
  types: [],
  searchUUID: '',
});
```

### handleFilterApply

```js
const handleFilterApply = useCallback(filters => {
  searchUUIDRef.current = customUUID();
  setIsLoadingNewTxs(true);
  setCurrentFilter({ ...filters, searchUUID: searchUUIDRef.current });
}, []);
```

### Transaction loading

```js
const hasActiveFilters =
  currentFilter.directions.length > 0 ||
  currentFilter.dateRange !== null ||
  currentFilter.types.length > 0;

if (!hasActiveFilters) {
  transactions = sparkInformation.transactions;
} else {
  transactions = await getFilteredTransactions(currentFilter, {
    accountId: sparkInformation.identityPubKey,
  });
}
```

### Filter subtitle

Replace the existing single-label `ThemeText` with a computed summary string built from translation keys:

- No active filters → `t('screens.inAccount.viewAllTxPage.filterAll')` ("All")
- Active filters → concatenate active labels joined by `·` (e.g. `"Received · Last 30 days · Lightning"`)

Translation key mapping for summary labels:

| Dimension  | Value         | Translation key   |
| ---------- | ------------- | ----------------- |
| directions | `'sent'`      | `filterSent`      |
| directions | `'received'`  | `filterReceived`  |
| dateRange  | `'7d'`        | `filterDate7d`    |
| dateRange  | `'30d'`       | `filterDate30d`   |
| dateRange  | `'90d'`       | `filterDate90d`   |
| dateRange  | `'1y'`        | `filterDate1y`    |
| types      | `'Lightning'` | `filterLightning` |
| types      | `'Bitcoin'`   | `filterBitcoin`   |
| types      | `'Spark'`     | `filterSpark`     |
| types      | `'Contacts'`  | `filterContacts`  |
| types      | `'Gifts'`     | `filterGifts`     |
| types      | `'Swaps'`     | `filterSwaps`     |
| types      | `'Savings'`   | `filterSavings`   |
| types      | `'Pools'`     | `filterPools`     |

Build the summary as: `[...directionLabels, dateLabel, ...typeLabels].filter(Boolean).join(' · ')`. If the result is empty, show `filterAll`.

### Modal navigation

```js
navigate.navigate('CustomHalfModal', {
  wantedContent: 'txFilter',
  sliderHight: 0.65,
  currentFilter: {
    directions: currentFilter.directions,
    dateRange: currentFilter.dateRange,
    types: currentFilter.types,
  },
  onSelectFilter: filters => handleFilterApply(filters),
});
```

### Badge

```js
const badgeCount =
  currentFilter.directions.length +
  (currentFilter.dateRange ? 1 : 0) +
  currentFilter.types.length;
```

Pass `badgeCount` to `CustomSettingsTopBar`.

---

## 4. CustomSettingsTopBar Changes

**File:** `app/functions/CustomElements/settingsTopBar.js`

Replace `badgeVisible: bool` prop with `badgeCount: number` (0 = hidden). Only `viewAllTxPage.js` currently passes `badgeVisible` — no other screen uses it, so no other call sites need updating.

When `badgeCount > 0`:

- Wrap the right icon `TouchableOpacity` in a `View` that adds a visible border ring (1.5px, accent color, borderRadius to match icon button shape).
- Render a small filled circle absolutely positioned top-right of the icon, containing centred `Text` showing the count.
- Badge circle: ~18px diameter, accent background, white text, `fontSize: 10`.

When `badgeCount === 0` (or prop absent): no ring, no badge — same as current behaviour.

Update `ViewAllTxPage` to pass `badgeCount` instead of `badgeVisible`.

---

## 5. getFilteredTransactions Changes

**File:** `app/functions/spark/transactions.js`

New signature: `getFilteredTransactions(filters, options)` where `filters` is the filter state object.

Build a single SQL query dynamically with AND conditions for each active dimension:

**Direction condition** (if `directions.length > 0`):

```sql
AND json_extract(details, '$.direction') IN (?, ...)
```

Map `'sent'` → `'OUTGOING'`, `'received'` → `'INCOMING'`.

**Date condition** (if `dateRange !== null`):

```sql
AND json_extract(details, '$.time') >= ?
```

Pass `Date.now() - offset` (an absolute ms timestamp) as the query parameter — **not** the raw offset duration. Offset values by key:

- `'7d'` → `7 * 24 * 60 * 60 * 1000`
- `'30d'` → `30 * 24 * 60 * 60 * 1000`
- `'90d'` → `90 * 24 * 60 * 60 * 1000`
- `'1y'` → `365 * 24 * 60 * 60 * 1000`

Example: `const cutoffMs = Date.now() - DATE_OFFSETS[dateRange];` — pass `cutoffMs` as the `?` param.

**Type condition** (if `types.length > 0`): OR across selected types, using the same per-type SQL expressions as the current switch cases:

| Type        | SQL expression                                                                                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Lightning` | `paymentType = 'lightning'`                                                                                                                                                                           |
| `Bitcoin`   | `paymentType = 'bitcoin'`                                                                                                                                                                             |
| `Spark`     | `paymentType = 'spark'`                                                                                                                                                                               |
| `Contacts`  | `json_type(details, '$.sendingUUID') = 'text' AND TRIM(json_extract(details, '$.sendingUUID')) != ''`                                                                                                 |
| `Gifts`     | `json_extract(details, '$.isGift') = 1`                                                                                                                                                               |
| `Swaps`     | `(json_extract(details, '$.showSwapLabel') = 1 OR (json_extract(details, '$.isLRC20Payment') = 1 AND json_extract(details, '$.direction') = 'OUTGOING' AND paymentType IN ('lightning', 'bitcoin')))` |
| `Savings`   | `json_extract(details, '$.isSavings') = 1`                                                                                                                                                            |
| `Pools`     | `json_extract(details, '$.isPoolPayment') = 1`                                                                                                                                                        |

Wrapped: `AND (type_expr_1 OR type_expr_2 OR ...)`.

If all three dimensions are inactive, fall through to `getAllSparkTransactions({ accountId })`.

---

## 6. CustomHalfModal Registration

**File:** `app/functions/CustomElements/halfModal.js`

Update the `txFilter` case to pass the new props shape:

```js
case 'txFilter':
  return (
    <TxFilterHalfModal
      currentFilter={props?.route?.params?.currentFilter}
      onSelectFilter={props?.route?.params?.onSelectFilter}
      handleBackPressFunction={handleBackPressFunction}
      setContentHeight={setContentHeight}
    />
  );
```

---

## 7. Translation Keys

New keys under `screens.inAccount.viewAllTxPage` in en locale files.

| Key                    | English                                  |
| ---------------------- | ---------------------------------------- |
| `filterModalTitle`     | `"Filter Transactions"` (already exists) |
| `filterDirectionTitle` | `"Direction"`                            |
| `filterSent`           | `"Sent"`                                 |
| `filterReceived`       | `"Received"`                             |
| `filterDateTitle`      | `"Date Range"`                           |
| `filterDate7d`         | `"Last 7 days"`                          |
| `filterDate30d`        | `"Last 30 days"`                         |
| `filterDate90d`        | `"Last 90 days"`                         |
| `filterDate1y`         | `"Last 12 months"`                       |
| `filterTypeTitle`      | `"Transaction Type"`                     |
| `filterApply`          | `"Apply Filters"`                        |
| `filterClearAll`       | `"Clear All"`                            |

Existing keys reused: `filterAll`, `filterLightning`, `filterBitcoin`, `filterSpark`, `filterContacts`, `filterGifts`, `filterSwaps`, `filterSavings`, `filterPools`, `exportButton`.

---

## 8. Files Changed

| File                                                                     | Change                                                                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `app/screens/inAccount/viewAllTxPage.js`                                 | New filter state shape, `handleFilterApply`, updated modal call, badge count, subtitle summary |
| `app/functions/CustomElements/settingsTopBar.js`                         | Replace `badgeVisible` with `badgeCount`, add ring + numbered badge                            |
| `app/functions/CustomElements/halfModal.js`                              | Update `txFilter` case to pass `setContentHeight`                                              |
| `app/components/admin/homeComponents/homeLightning/txFilterHalfModal.js` | Full rewrite — three sections, draft state, Apply/Clear                                        |
| `app/functions/spark/transactions.js`                                    | Rewrite `getFilteredTransactions` to accept filter object                                      |
| `locales/en/translation.json` (+ 8 other locales)                        | Add new translation keys                                                                       |

---

## 9. Verification

1. Open ViewAllTxPage — badge count shows 0, subtitle shows "All".
2. Tap filter icon — modal opens with all sections unselected (matching current empty state).
3. Select "Received" + "Last 30 days" + "Lightning" → tap Apply.
4. Modal closes, subtitle shows "Received · Last 30 days · Lightning", badge shows "3".
5. Tap filter icon again — draft pre-populated with the active filters.
6. Tap "Clear All" in modal — all draft selections reset but modal stays open.
7. Tap Apply — empty filters applied, subtitle shows "All", badge hidden, ring gone.
8. Select only "Sent" — Apply — only sent txs appear, badge shows "1".
9. Verify multi-type: select Lightning + Bitcoin — both appear in list.
10. Verify date filter cuts off transactions older than selected range.
