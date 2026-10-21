import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useKeysContext } from '../../../../../context-store/keys';
import loadNewFiatData from '../../../../functions/saveAndUpdateFiatData';
import { fiatCurrencies } from '../../../../functions/currencyOptions';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { keyboardGoBack } from '../../../../functions/customNavigation';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import SearchField from '../../../../functions/CustomElements/redesign/SearchField';
import ListCard, {
  ListDivider,
} from '../../../../functions/CustomElements/redesign/ListCard';
import CurrencyRow from '../currencyPicker/currencyRow';

export default function FiatCurrencyPage() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { toggleFiatStats, fiatStats } = useNodeContext();
  const { tokens } = useGlobalThemeContext();
  const isGoingBackRef = useRef(false);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const [textInput, setTextInput] = useState('');
  const [savingCurrency, setSavingCurrency] = useState(null);
  const { t } = useTranslation();
  const navigate = useNavigation();

  const currentCurrency = masterInfoObject?.fiatCurrency;

  const currencies = useMemo(() => {
    const sorted = [...fiatCurrencies].sort((a, b) => a.id.localeCompare(b.id));
    const current = sorted.find(
      currency => currency.id.toLowerCase() === currentCurrency?.toLowerCase(),
    );
    return current
      ? [current, ...sorted.filter(currency => currency !== current)]
      : sorted;
  }, [currentCurrency]);

  const filteredList = useMemo(() => {
    const search = textInput.toLowerCase();
    return currencies.filter(
      currency =>
        currency.info.name.toLowerCase().includes(search) ||
        currency.id.toLowerCase().startsWith(search),
    );
  }, [textInput, currencies]);

  const handleBack = useCallback(() => {
    if (isGoingBackRef.current || savingCurrency) return;
    isGoingBackRef.current = true;
    keyboardGoBack(navigate);
  }, [navigate, savingCurrency]);

  const saveCurrencySettings = useCallback(
    async selectedCurrency => {
      if (savingCurrency) return;
      setSavingCurrency(selectedCurrency);
      try {
        const response = await loadNewFiatData(
          selectedCurrency,
          contactsPrivateKey,
          publicKey,
          { fiatCurrency: selectedCurrency },
        );

        if (!response.didWork) throw new Error('error saving fiat data');

        toggleFiatStats(response.fiatRateResponse);
        toggleMasterInfoObject({ fiatCurrency: selectedCurrency });
        if (isGoingBackRef.current) return;
        isGoingBackRef.current = true;
        keyboardGoBack(navigate);
      } catch (err) {
        console.log(err);
        setSavingCurrency(null);
        navigate.navigate('ErrorScreen', {
          errorMessage: t('settings.fiatCurrency.saveCurrencyError'),
        });
      }
    },
    [
      contactsPrivateKey,
      publicKey,
      toggleFiatStats,
      toggleMasterInfoObject,
      navigate,
      t,
      savingCurrency,
    ],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <CurrencyRow
        currency={item}
        isSelected={
          item.id?.toLowerCase() === currentCurrency?.toLowerCase() ||
          savingCurrency === item.id
        }
        onSelect={saveCurrencySettings}
        saving={savingCurrency === item.id}
        disabled={!!savingCurrency}
      />
    ),
    [currentCurrency, saveCurrencySettings, savingCurrency],
  );

  const rateSubtitle = fiatStats?.value
    ? `1 BTC ≈ ${displayCorrectDenomination({
        amount: Math.round(fiatStats.value),
        masterInfoObject: {
          ...masterInfoObject,
          userBalanceDenomination: 'fiat',
        },
        fiatStats,
        forceCurrency: masterInfoObject.fiatCurrency,
        convertAmount: false,
      })}`
    : undefined;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar title={t('settings.fiatCurrency.title')} onBack={handleBack} />
        {!!rateSubtitle && (
          <ThemeText
            content={rateSubtitle}
            styles={[styles.rate, { color: tokens.muted }]}
          />
        )}
        <View style={styles.search}>
          <SearchField
            pill
            value={textInput}
            onChangeText={setTextInput}
            placeholder={t('settings.fiatCurrency.placeholderText')}
          />
        </View>
        <ListCard dividerInset={52} style={styles.card}>
          <FlatList
            data={filteredList}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={5}
            ItemSeparatorComponent={CurrencySeparator}
            contentContainerStyle={styles.listContent}
          />
        </ListCard>
      </View>
    </GlobalThemeView>
  );
}

const keyExtractor = currency => currency.id;

function CurrencySeparator() {
  return <ListDivider inset={52} />;
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', flex: 1 },
  rate: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 2,
    includeFontPadding: false,
  },
  search: { marginTop: 16 },
  card: { flex: 1, marginTop: 16 },
  listContent: { paddingBottom: 24 },
});
