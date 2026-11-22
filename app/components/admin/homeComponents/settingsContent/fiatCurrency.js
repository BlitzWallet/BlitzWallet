import { StyleSheet, View, useWindowDimensions } from 'react-native';
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
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import HideOnScrollView from '../../../../functions/CustomElements/redesign/HideOnScrollView';
import { FADE_TOP } from '../../../../functions/CustomElements/redesign/TopFade';
import CurrencyRow from '../currencyPicker/currencyRow';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';

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
        <TopBar
          fade
          title={t('settings.fiatCurrency.title')}
          onBack={handleBack}
        />
        <HideOnScrollView
          topInset={FADE_TOP}
          keyboardShouldPersistTaps="always"
          header={
            <SearchField
              pill
              value={textInput}
              onChangeText={setTextInput}
              placeholder={t('settings.fiatCurrency.placeholderText')}
            />
          }
        >
          {filteredList.length === 0 ? (
            <View style={styles.empty}>
              <EmptyState
                icon="Search"
                title={t('constants.noSearchResults')}
                sub={t('constants.noSearchResultsSub')}
              />
            </View>
          ) : (
            <ListCard dividerInset={52}>
              {filteredList.map(item => (
                <CurrencyRow
                  key={item.id}
                  currency={item}
                  isSelected={
                    item.id?.toLowerCase() === currentCurrency?.toLowerCase() ||
                    savingCurrency === item.id
                  }
                  onSelect={saveCurrencySettings}
                  saving={savingCurrency === item.id}
                  disabled={!!savingCurrency}
                />
              ))}
            </ListCard>
          )}
        </HideOnScrollView>
      </View>
    </GlobalThemeView>
  );
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
  empty: { marginTop: 48 },
});
