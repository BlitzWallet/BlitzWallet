import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CENTER } from '../../../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../../../constants/theme';
import { useAppStatus } from '../../../../../../../context-store/appStatus';
import { fiatCurrencies } from '../../../../../../functions/currencyOptions';
import PageTitle from '../../../../../../functions/CustomElements/redesign/PageTitle';
import SearchField from '../../../../../../functions/CustomElements/redesign/SearchField';
import ListCard, {
  ListDivider,
} from '../../../../../../functions/CustomElements/redesign/ListCard';
import { SheetSurface } from '../../../../../../functions/CustomElements/redesign/sheetSurface';
import CurrencyRow from '../../../currencyPicker/currencyRow';

// Store currency picker for Point of sale (same rows as Settings › Currency).
export default function POSCurrencySelect({
  currentCurrency,
  onSelectCurrency,
  handleBackPressFunction,
  setContentHeight,
  setIsKeyboardActive,
}) {
  const { t } = useTranslation();
  const { screenDimensions } = useAppStatus();
  const [search, setSearch] = useState('');

  useEffect(() => {
    setContentHeight(screenDimensions.height * 0.7);
  }, [setContentHeight, screenDimensions.height]);

  const currencies = useMemo(() => {
    const sorted = [...fiatCurrencies].sort((a, b) => a.id.localeCompare(b.id));
    const current = sorted.find(currency => currency.id === currentCurrency);
    const ordered = current
      ? [current, ...sorted.filter(currency => currency !== current)]
      : sorted;
    const term = search.toLowerCase();
    return ordered.filter(
      currency =>
        currency.info.name.toLowerCase().includes(term) ||
        currency.id.toLowerCase().startsWith(term),
    );
  }, [currentCurrency, search]);

  const handleSelect = useCallback(
    currencyId => {
      handleBackPressFunction();
      if (currencyId !== currentCurrency) onSelectCurrency?.(currencyId);
    },
    [currentCurrency, handleBackPressFunction, onSelectCurrency],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <CurrencyRow
        currency={item}
        isSelected={item.id === currentCurrency}
        onSelect={handleSelect}
      />
    ),
    [currentCurrency, handleSelect],
  );

  return (
    <SheetSurface>
      <View style={styles.container}>
        <PageTitle
          text={t('settings.posPath.settings.currencySheetTitle')}
          titleStyles={styles.title}
        />
        <SearchField
          pill
          value={search}
          onChangeText={setSearch}
          placeholder={t('settings.fiatCurrency.placeholderText')}
          onFocus={() => setIsKeyboardActive?.(true)}
          onBlur={() => setIsKeyboardActive?.(false)}
        />
        <ListCard tone="flush" style={styles.card}>
          <FlatList
            data={currencies}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            ItemSeparatorComponent={CurrencySeparator}
          />
        </ListCard>
      </View>
    </SheetSurface>
  );
}

const keyExtractor = currency => currency.id;

function CurrencySeparator() {
  return <ListDivider inset={52} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER },
  title: {
    fontSize: 20,
    lineHeight: 26,
    marginTop: 8,
    marginBottom: 16,
    includeFontPadding: false,
  },
  card: { flex: 1, marginTop: 16 },
});
