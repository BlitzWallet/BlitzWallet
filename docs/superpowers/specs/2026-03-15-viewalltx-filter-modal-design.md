# ViewAllTxPage Filter Modal Design

**Date:** 2026-03-15
**Status:** Approved

## Overview

Replace the horizontal scrollable pill filter bar on `ViewAllTxPage` with a filter icon button in the navbar that opens a `CustomHalfModal`. Move the export button to a sticky bottom position. The filter icon shows a badge dot when a non-default filter is active.

---

## 1. ViewAllTxPage Layout Changes

### Navbar

- Replace the `Share` (export) icon in `CustomSettingsTopBar`'s right slot with a `SlidersHorizontal` (filter) icon.
- Add a new optional `badgeVisible` boolean prop to `CustomSettingsTopBar`. When `true`, renders a small filled circle (~8px, `COLORS.primary`) absolutely positioned in the top-right corner of the right icon.
- `badgeVisible` is driven by `currentFilter.item !== 'All'` in `ViewAllTxPage`.

### Pill bar removal

- Remove the horizontal `ScrollView` pill filter block and its conditional wrapper.
- Remove all scroll-tracking refs: `pillLayoutsRef`, `scrollViewRef`, `scrollViewWidthRef`, `scrollOffsetRef`.
- Remove the scroll logic inside `handleFilterSwitch` — it simplifies to only updating state + `searchUUID`.
- Remove the `filterOptions` `useMemo`.

### Bottom export button

- Render a sticky `TouchableOpacity` below the `FlatList` (or above it, always visible regardless of list state).
- Contains a `Share` `ThemeIcon` + `ThemeText` label using translation key `screens.inAccount.viewAllTxPage.exportButton`.
- Styled using `backgroundOffset` background, consistent with secondary action rows elsewhere in the app.
- On press: navigates to `CustomHalfModal` with `wantedContent: 'exportTransactions'` (same as current behavior).

---

## 2. TxFilterHalfModal Component

**File:** `app/components/admin/homeComponents/homeLightning/txFilterHalfModal.js`

### Props (all via `route.params` in `CustomHalfModal`)

| Prop | Type | Description |
|---|---|---|
| `currentFilter` | `string` | Currently active filter key (e.g. `'All'`) |
| `onSelectFilter` | `function` | Callback called with selected key; closes modal after |
| `handleBackPressFunction` | `function` | Standard close handler from `CustomHalfModal` |

> `setContentHeight` is **not used** — modal uses the default `sliderHight` (0.5).

### Layout

- Title row using translation key `screens.inAccount.viewAllTxPage.filterModalTitle`.
- Vertical list of all 9 `FILTER_KEYS` (`All`, `Lightning`, `Bitcoin`, `Spark`, `Contacts`, `Gifts`, `Swaps`, `Savings`, `Pools`).
- Each row: `ThemeText` label on the left, `CheckMarkCircle` with `isActive={currentFilter === key}` on the right.
- Row labels use existing keys: `screens.inAccount.viewAllTxPage.filter${key}`.
- Tapping a row: calls `onSelectFilter(key)`, then calls `handleBackPressFunction()` to auto-close. No explicit "Apply" button.

---

## 3. CustomHalfModal Registration

**File:** `app/functions/CustomElements/halfModal.js`

Add a new case to `renderContent`:

```js
case 'txFilter':
  return (
    <TxFilterHalfModal
      currentFilter={props?.route?.params?.currentFilter}
      onSelectFilter={props?.route?.params?.onSelectFilter}
      handleBackPressFunction={handleBackPressFunction}
    />
  );
```

No `paddingBottom` special-casing needed (no keyboard input in this modal).

---

## 4. Opening the Modal

In `ViewAllTxPage`, the filter icon's `onPress`:

```js
navigate.navigate('CustomHalfModal', {
  wantedContent: 'txFilter',
  sliderHight: 0.5,
  currentFilter: currentFilter.item,
  onSelectFilter: item => handleFilterSwitch(item),
});
```

---

## 5. Translation Keys

Two new keys added to `screens.inAccount.viewAllTxPage` in all locale files:

| Key | English value |
|---|---|
| `filterModalTitle` | `"Filter Transactions"` |
| `exportButton` | `"Export"` |

All existing `filter${key}` keys are reused as-is for row labels.

---

## 6. Files Changed

| File | Change |
|---|---|
| `app/screens/inAccount/viewAllTxPage.js` | Remove pill bar + refs, add badge prop to top bar, add bottom export button, update modal navigation call |
| `app/functions/CustomElements/settingsTopBar.js` | Add `badgeVisible` prop + badge dot rendering |
| `app/functions/CustomElements/halfModal.js` | Add `txFilter` case to `renderContent` |
| `app/components/admin/homeComponents/homeLightning/txFilterHalfModal.js` | New component |
| `locales/en/translation.json` (+ all other locales) | Add `filterModalTitle` and `exportButton` keys |
