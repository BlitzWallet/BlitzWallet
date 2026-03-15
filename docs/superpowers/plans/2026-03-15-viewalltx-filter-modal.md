# ViewAllTxPage Filter Modal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the horizontal scrollable filter pill bar on ViewAllTxPage with a filter icon in the navbar that opens a half modal, and move the export button to a sticky bottom position.

**Architecture:** Add a `badgeVisible` prop to `CustomSettingsTopBar` for the active-filter indicator dot. Create a new `TxFilterHalfModal` content component registered in the existing `CustomHalfModal` router. Restructure `ViewAllTxPage` to remove the pill bar, wire the new navbar filter button, and add a sticky bottom export button outside the flex content area.

**Tech Stack:** React Native, React Navigation v7, react-i18next, lucide-react-native icons, reanimated (existing half modal infrastructure)

**Spec:** `docs/superpowers/specs/2026-03-15-viewalltx-filter-modal-design.md`

---

## Chunk 1: Translation keys

### Task 1: Add translation keys to all 9 locale files

**Files:**
- Modify: `locales/en/translation.json:1931`
- Modify: `locales/de-DE/translation.json`
- Modify: `locales/es/translation.json`
- Modify: `locales/fr/translation.json`
- Modify: `locales/it/translation.json`
- Modify: `locales/ko/translation.json`
- Modify: `locales/pt-BR/translation.json`
- Modify: `locales/ru/translation.json`
- Modify: `locales/sv/translation.json`

- [ ] **Step 1: Add keys to `locales/en/translation.json`**

The `viewAllTxPage` block ends at line 1932 with `}`. Insert two new keys after `noTxHistorySub` (line 1931):

```json
"noTxHistorySub": "Your transactions will appear here once you send or receive one.",
"filterModalTitle": "Filter Transactions",
"exportButton": "Export"
```

- [ ] **Step 2: Add keys to the remaining 8 locale files**

For each locale below, find `noTxHistorySub` in the `viewAllTxPage` block and add the two new keys immediately after it with the same English values (translation updates happen separately):

```json
"filterModalTitle": "Filter Transactions",
"exportButton": "Export"
```

For `locales/ko/translation.json` the `viewAllTxPage` block only has `"title": "Transactions"` with no other keys. Insert after `"title"`:

```json
"title": "Transactions",
"filterModalTitle": "Filter Transactions",
"exportButton": "Export"
```

Locale files to update (find `noTxHistorySub` in each, or `"title": "Transactions"` for `ko`):
- `locales/de-DE/translation.json`
- `locales/es/translation.json`
- `locales/fr/translation.json`
- `locales/it/translation.json`
- `locales/ko/translation.json`
- `locales/pt-BR/translation.json`
- `locales/ru/translation.json`
- `locales/sv/translation.json`

- [ ] **Step 3: Verify keys exist in all 9 files**

```bash
grep -r "filterModalTitle" locales/
grep -r "exportButton" locales/
```

Expected: 9 matches for each key — one per locale directory.

- [ ] **Step 4: Commit**

```bash
git add locales/
git commit -m "feat: add filterModalTitle and exportButton translation keys"
```

---

## Chunk 2: CustomSettingsTopBar badge prop

### Task 2: Add `badgeVisible` prop to CustomSettingsTopBar

**Files:**
- Modify: `app/functions/CustomElements/settingsTopBar.js`

- [ ] **Step 1: Add `badgeVisible` to the function signature**

Current signature (line 10–24):
```js
export default function CustomSettingsTopBar({
  containerStyles,
  textStyles,
  label,
  shouldDismissKeyboard,
  showLeftImage,
  leftImageFunction,
  leftImageBlue,
  LeftImageDarkMode,
  leftImageStyles = {},
  customBackFunction,
  customBackColor,
  iconNew = '',
  iconNewColor = undefined,
}) {
```

Add `badgeVisible = false` to the destructured props:
```js
export default function CustomSettingsTopBar({
  containerStyles,
  textStyles,
  label,
  shouldDismissKeyboard,
  showLeftImage,
  leftImageFunction,
  leftImageBlue,
  LeftImageDarkMode,
  leftImageStyles = {},
  customBackFunction,
  customBackColor,
  iconNew = '',
  iconNewColor = undefined,
  badgeVisible = false,
}) {
```

- [ ] **Step 2: Add the badge dot inside the right-icon TouchableOpacity**

Find the `showLeftImage` block (lines 55–79). It currently renders:

```js
{showLeftImage && (
  <TouchableOpacity
    style={{
      position: 'absolute',
      right: 0,
      zIndex: 1,
    }}
    onPress={leftImageFunction}
  >
    {iconNew ? (
      <ThemeIcon
        colorOverride={iconNewColor}
        size={leftImageStyles?.height}
        iconName={iconNew}
      />
    ) : (
      <ThemeImage
        styles={{ ...leftImageStyles }}
        lightsOutIcon={LeftImageDarkMode}
        darkModeIcon={leftImageBlue}
        lightModeIcon={leftImageBlue}
      />
    )}
  </TouchableOpacity>
)}
```

Replace with (add badge dot as a child of the `TouchableOpacity`):

```js
{showLeftImage && (
  <TouchableOpacity
    style={{
      position: 'absolute',
      right: 0,
      zIndex: 1,
    }}
    onPress={leftImageFunction}
  >
    {iconNew ? (
      <ThemeIcon
        colorOverride={iconNewColor}
        size={leftImageStyles?.height}
        iconName={iconNew}
      />
    ) : (
      <ThemeImage
        styles={{ ...leftImageStyles }}
        lightsOutIcon={LeftImageDarkMode}
        darkModeIcon={leftImageBlue}
        lightModeIcon={leftImageBlue}
      />
    )}
    {badgeVisible && (
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: COLORS.primary,
        }}
      />
    )}
  </TouchableOpacity>
)}
```

- [ ] **Step 3: Import COLORS**

`COLORS` is already imported via `import { CENTER, FONT, ICONS, SIZES } from '../../constants';` — check if `COLORS` is available from that import. It is defined in `app/constants/index.js`. Add `COLORS` to the import:

```js
import { CENTER, COLORS, FONT, ICONS, SIZES } from '../../constants';
```

- [ ] **Step 4: Verify the component renders without errors**

Run Metro bundler and check for syntax errors:
```bash
yarn start
```

Expected: bundler starts without errors, no red screen on opening any screen that uses `CustomSettingsTopBar`.

- [ ] **Step 5: Commit**

```bash
git add app/functions/CustomElements/settingsTopBar.js
git commit -m "feat: add badgeVisible prop to CustomSettingsTopBar"
```

---

## Chunk 3: TxFilterHalfModal + halfModal registration

### Task 3: Create TxFilterHalfModal component

**Files:**
- Create: `app/components/admin/homeComponents/homeLightning/txFilterHalfModal.js`

The `FILTER_KEYS` array is currently defined in `viewAllTxPage.js`. This component needs the same list. Define it inline in the component file (do not import from `viewAllTxPage` — that would create a cross-screen dependency).

- [ ] **Step 1: Create the file**

```js
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { CENTER } from '../../../../constants';

const FILTER_KEYS = [
  'All',
  'Lightning',
  'Bitcoin',
  'Spark',
  'Contacts',
  'Gifts',
  'Swaps',
  'Savings',
  'Pools',
];

export default function TxFilterHalfModal({
  currentFilter,
  onSelectFilter,
  handleBackPressFunction,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.title}
        content={t('screens.inAccount.viewAllTxPage.filterModalTitle')}
      />
      {FILTER_KEYS.map(key => {
        const isActive = currentFilter === key;
        return (
          <TouchableOpacity
            key={key}
            style={styles.row}
            onPress={() => {
              onSelectFilter(key);
              handleBackPressFunction();
            }}
            activeOpacity={0.7}
          >
            <ThemeText
              styles={styles.rowLabel}
              content={t(
                `screens.inAccount.viewAllTxPage.filter${key}`,
              )}
            />
            <CheckMarkCircle
              isActive={isActive}
              containerSize={24}
              switchDarkMode={theme && darkModeType}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    paddingBottom: 8,
  },
  title: {
    fontSize: SIZES.large,
    textAlign: 'center',
    marginBottom: 16,
    includeFontPadding: false,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLabel: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
});
```

- [ ] **Step 2: Verify imports resolve**

Check that the import paths are correct by searching for the files:
- `../../../../functions/CustomElements` → `app/functions/CustomElements/index.js` (should export `ThemeText`)
- `../../../../functions/CustomElements/checkMarkCircle` → `app/functions/CustomElements/checkMarkCircle.js` ✓
- `../../../../../context-store/theme` → `context-store/theme.js` ✓
- `../../../../constants/theme` → `app/constants/theme.js` (exports `INSET_WINDOW_WIDTH` and `SIZES`)
- `../../../../constants` → `app/constants/index.js` (exports `CENTER`)

```bash
grep -n "INSET_WINDOW_WIDTH\|SIZES" app/constants/theme.js | head -5
grep -n "^export.*CENTER\|CENTER" app/constants/index.js | head -5
```

- [ ] **Step 3: Commit**

```bash
git add app/components/admin/homeComponents/homeLightning/txFilterHalfModal.js
git commit -m "feat: add TxFilterHalfModal component"
```

### Task 4: Register txFilter case in CustomHalfModal

**Files:**
- Modify: `app/functions/CustomElements/halfModal.js`

- [ ] **Step 1: Import TxFilterHalfModal**

At the top of `halfModal.js` with the other half-modal content imports, add:

```js
import TxFilterHalfModal from '../../components/admin/homeComponents/homeLightning/txFilterHalfModal';
```

- [ ] **Step 2: Add the `txFilter` case to `renderContent`**

In the `switch (contentType)` block (before the `default` case), add:

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

No `paddingBottom` special-casing is needed in the outer container (no keyboard input).

- [ ] **Step 3: Verify Metro compiles without errors**

```bash
yarn start
```

Expected: no bundler errors.

- [ ] **Step 4: Commit**

```bash
git add app/functions/CustomElements/halfModal.js
git commit -m "feat: register txFilter case in CustomHalfModal"
```

---

## Chunk 4: ViewAllTxPage refactor

### Task 5: Update ViewAllTxPage

**Files:**
- Modify: `app/screens/inAccount/viewAllTxPage.js`

This task removes the pill bar, updates the navbar to use the filter modal, and adds the sticky bottom export button.

- [ ] **Step 1: Remove pill-bar refs and memoized filter options**

Remove these lines from the `useRef` declarations and variable area (lines 63–65, 171–205):

Remove refs:
```js
const pillLayoutsRef = useRef({}); // { [key]: { x, width } }
const scrollViewWidthRef = useRef(0);
const scrollOffsetRef = useRef(0);
// also remove scrollViewRef (keep it only if used elsewhere — it is not)
const scrollViewRef = useRef(null);
```

Remove the entire `filterOptions` useMemo block (lines 171–205).

- [ ] **Step 2: Simplify `handleFilterSwitch`**

The current `handleFilterSwitch` (lines 140–169) contains scroll logic after the state update. Simplify it to only update state:

```js
const handleFilterSwitch = useCallback(item => {
  searchUUIDRef.current = customUUID();
  setIsLoadingNewTxs(true);
  setCurrentFilter({ item, searchUUID: searchUUIDRef.current });
}, []);
```

- [ ] **Step 3: Remove the `ScrollView` import if no longer used**

After removing the pill bar, `ScrollView` is no longer used. Remove it from the React Native import block:

```js
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
```

- [ ] **Step 4: Update `CustomSettingsTopBar` in JSX**

Replace the current top bar call:

```js
<CustomSettingsTopBar
  showLeftImage={true}
  iconNew="Share"
  label={t('screens.inAccount.viewAllTxPage.title')}
  leftImageFunction={() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'exportTransactions',
      sliderHight: 0.5,
    });
  }}
/>
```

With:

```js
<CustomSettingsTopBar
  showLeftImage={true}
  iconNew="SlidersHorizontal"
  badgeVisible={currentFilter.item !== 'All'}
  label={t('screens.inAccount.viewAllTxPage.title')}
  leftImageFunction={() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'txFilter',
      sliderHight: 0.5,
      currentFilter: currentFilter.item,
      onSelectFilter: item => handleFilterSwitch(item),
    });
  }}
/>
```

- [ ] **Step 5: Remove the pill bar ScrollView block**

Remove the entire conditional pill bar block (lines 222–240):

```js
{(!doesNotHaveTransactions || currentFilter.item !== 'All') && (
  <View>
    <ScrollView
      ref={scrollViewRef}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterPillScroll}
      horizontal
      onScroll={e => {
        scrollOffsetRef.current = e.nativeEvent.contentOffset.x;
      }}
      scrollEventThrottle={16}
      onLayout={e => {
        scrollViewWidthRef.current = e.nativeEvent.layout.width;
      }}
    >
      {filterOptions}
    </ScrollView>
  </View>
)}
```

- [ ] **Step 6: Wrap conditional content in a flex:1 View and add the sticky export button**

Replace the current conditional content block:

```js
{!txs.length || isLoadingNewTxs ? (
  <FullLoadingScreen />
) : doesNotHaveTransactions ? (
  <NoContentSceen
    iconName="Clock"
    titleText={t('screens.inAccount.viewAllTxPage.noTxHistoryTitle')}
    subTitleText={t('screens.inAccount.viewAllTxPage.noTxHistorySub')}
  />
) : (
  <FlatList
    initialNumToRender={20}
    maxToRenderPerBatch={20}
    windowSize={3}
    style={{ flex: 1, width: '100%' }}
    showsVerticalScrollIndicator={false}
    data={txs}
    renderItem={({ item }) => item?.item}
    ListFooterComponent={
      <View
        style={{
          width: '100%',
          height: bottomPadding,
        }}
      />
    }
  />
)}
```

With:

```js
<View style={{ flex: 1 }}>
  {!txs.length || isLoadingNewTxs ? (
    <FullLoadingScreen />
  ) : doesNotHaveTransactions ? (
    <NoContentSceen
      iconName="Clock"
      titleText={t('screens.inAccount.viewAllTxPage.noTxHistoryTitle')}
      subTitleText={t('screens.inAccount.viewAllTxPage.noTxHistorySub')}
    />
  ) : (
    <FlatList
      initialNumToRender={20}
      maxToRenderPerBatch={20}
      windowSize={3}
      style={{ flex: 1, width: '100%' }}
      showsVerticalScrollIndicator={false}
      data={txs}
      renderItem={({ item }) => item?.item}
      ListFooterComponent={
        <View style={{ width: '100%', height: 8 }} />
      }
    />
  )}
</View>
<TouchableOpacity
  style={[
    styles.exportButton,
    { backgroundColor: backgroundOffset, paddingBottom: bottomPadding },
  ]}
  onPress={() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'exportTransactions',
      sliderHight: 0.5,
    });
  }}
>
  <ThemeIcon iconName="Share" size={18} />
  <ThemeText
    styles={styles.exportButtonText}
    content={t('screens.inAccount.viewAllTxPage.exportButton')}
  />
</TouchableOpacity>
```

Note: The FlatList `ListFooterComponent` no longer needs `height: bottomPadding` since the bottom padding is now handled by the export button. Replace it with a small fixed gap (`height: 8`) so the last transaction item isn't flush with the export button.

- [ ] **Step 7: Add export button styles**

In the `StyleSheet.create` block, add:

```js
exportButton: {
  width: '100%',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  paddingTop: 14,
},
exportButtonText: {
  fontSize: SIZES.medium,
  includeFontPadding: false,
},
```

Also remove the now-unused styles:
- `filterPillScroll`
- `filterPillContainer`
- `pillText`
- `noTxContainer`
- `emptyTitle`
- `emptySubtext`

- [ ] **Step 8: Clean up unused imports**

Remove `CONTENT_KEYBOARD_OFFSET` from the constants import (was used only by `filterPillScroll`). Also remove `useMemo` from the React import (was used only by `filterOptions`).

Check for any remaining uses before removing:
```bash
grep -n "CONTENT_KEYBOARD_OFFSET\|useMemo" app/screens/inAccount/viewAllTxPage.js
```

Expected: zero matches for `CONTENT_KEYBOARD_OFFSET`, zero for `useMemo`.

- [ ] **Step 9: Verify no unused refs or variables remain**

```bash
grep -n "scrollViewRef\|pillLayoutsRef\|scrollViewWidthRef\|scrollOffsetRef\|filterOptions" app/screens/inAccount/viewAllTxPage.js
```

Expected: zero matches.

- [ ] **Step 10: Verify the full screen works**

Run the app, navigate to ViewAllTxPage and verify:
1. The navbar shows a filter (sliders) icon — no badge dot when filter is "All"
2. Tapping the filter icon opens a half modal with 9 rows and `CheckMarkCircle` indicators
3. Tapping a filter row updates the transaction list and closes the modal
4. The badge dot appears on the filter icon when a non-"All" filter is active
5. The export button is always visible at the bottom
6. Tapping export opens the export modal as before
7. The `SlidersHorizontal` icon from lucide renders — if it doesn't exist in the version used, substitute `Sliders` or `Filter`

```bash
grep -r "SlidersHorizontal" node_modules/lucide-react-native/src/ 2>/dev/null | head -3
```

If `SlidersHorizontal` is not found, use `Sliders` instead in both the `CustomSettingsTopBar` call.

- [ ] **Step 11: Commit**

```bash
git add app/screens/inAccount/viewAllTxPage.js
git commit -m "feat: replace filter pill bar with filter modal and sticky export button"
```
