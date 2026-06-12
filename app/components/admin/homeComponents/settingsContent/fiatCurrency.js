import { FlatList, StyleSheet } from 'react-native';
import { CONTENT_KEYBOARD_OFFSET, SIZES } from '../../../../constants';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  MAX_CONTENT_WIDTH,
} from '../../../../constants/theme';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import loadNewFiatData from '../../../../functions/saveAndUpdateFiatData';
import { fiatCurrencies } from '../../../../functions/currencyOptions';
import { useKeysContext } from '../../../../../context-store/keys';
import GetThemeColors from '../../../../hooks/themeColors';
import { keyboardGoBack } from '../../../../functions/customNavigation';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import CurrencyRow from '../currencyPicker/currencyRow';

export default function FiatCurrencyPage() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { toggleFiatStats, fiatStats } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const currencies = useMemo(() => {
    return [...fiatCurrencies].sort((a, b) => a.id.localeCompare(b.id));
  }, []);
  const isGoingBackRef = useRef(false);

  const [textInput, setTextInput] = useState('');
  const currentCurrency = masterInfoObject?.fiatCurrency;
  const { t } = useTranslation();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const { bottomPadding } = useGlobalInsets();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const navigate = useNavigation();

  const [isLoading, setIsLoading] = useState(false);

  const filteredList = useMemo(() => {
    const search = textInput.toLowerCase();
    return currencies.filter(
      currency =>
        currency.info.name.toLowerCase().includes(search) ||
        currency.id.toLowerCase().startsWith(search),
    );
  }, [textInput, currencies]);

  const saveCurrencySettings = useCallback(
    async selectedCurrency => {
      try {
        setIsLoading(true);

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
        setIsLoading(false);
        console.log(err);
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
    ],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <CurrencyRow
        currency={item}
        isSelected={item.id?.toLowerCase() === currentCurrency?.toLowerCase()}
        onSelect={saveCurrencySettings}
        theme={theme}
        darkModeType={darkModeType}
        backgroundOffset={backgroundOffset}
        iconBackground={backgroundColor}
      />
    ),
    [
      currentCurrency,
      saveCurrencySettings,
      theme,
      darkModeType,
      backgroundOffset,
      backgroundColor,
    ],
  );

  const contentContainerStyle = useMemo(
    () => ({
      ...styles.listContent,
      paddingBottom: bottomPadding,
    }),
    [bottomPadding],
  );

  const searchContainerStyle = useMemo(
    () => ({
      backgroundColor,
      width: INSET_WINDOW_WIDTH,
      paddingBottom: CONTENT_KEYBOARD_OFFSET,
    }),
    [backgroundColor],
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

  if (isLoading) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar
          shouldDismissKeyboard={true}
          label={t('settings.fiatCurrency.title')}
        />
        <FullLoadingScreen />
      </GlobalThemeView>
    );
  }

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        customBackFunction={() => {
          if (isGoingBackRef.current) return;
          isGoingBackRef.current = true;
          keyboardGoBack(navigate);
        }}
        label={t('settings.fiatCurrency.title')}
        containerStyles={{ marginBottom: 0 }}
      />
      <ThemeText content={rateSubtitle} styles={styles.subtitleText} />

      <FlatList
        style={styles.list}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={contentContainerStyle}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <CustomSearchInput
            setInputText={setTextInput}
            inputText={textInput}
            placeholderText={t('settings.fiatCurrency.placeholderText')}
            containerStyles={searchContainerStyle}
          />
        }
        data={filteredList}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={5}
        showsVerticalScrollIndicator={false}
      />
    </CustomKeyboardAvoidingView>
  );
}

const keyExtractor = currency => currency.id;

const styles = StyleSheet.create({
  list: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingTop: 20,
  },
  subtitleText: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    includeFontPadding: false,
    marginBottom: 10,
    marginTop: 5,
  },
});
