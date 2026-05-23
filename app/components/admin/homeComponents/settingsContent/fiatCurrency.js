import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS, CONTENT_KEYBOARD_OFFSET, SIZES } from '../../../../constants';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
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
  INSET_WINDOW_WIDTH,
  MAX_CONTENT_WIDTH,
} from '../../../../constants/theme';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import CountryFlag from 'react-native-country-flag';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import loadNewFiatData from '../../../../functions/saveAndUpdateFiatData';
import { fiatCurrencies } from '../../../../functions/currencyOptions';
import { useKeysContext } from '../../../../../context-store/keys';
import GetThemeColors from '../../../../hooks/themeColors';
import { keyboardGoBack } from '../../../../functions/customNavigation';

function currencyToCountryCode(currencyId) {
  if (currencyId === 'XOF') return 'ne';
  if (currencyId === 'ANG') return 'nl';
  return currencyId.substring(0, 2);
}

const CurrencyItem = memo(
  ({
    currency,
    isSelected,
    onSelect,
    theme,
    darkModeType,
    backgroundOffset,
  }) => {
    const countryCode = currencyToCountryCode(currency.id);
    const borderColor =
      theme && darkModeType ? COLORS.darkModeText : COLORS.primary;

    return (
      <TouchableOpacity
        style={[
          styles.currencyRow,
          {
            borderColor: isSelected ? borderColor : 'transparent',
            backgroundColor: backgroundOffset,
          },
        ]}
        onPress={() => onSelect(currency.id)}
      >
        {countryCode ? (
          <CountryFlag isoCode={countryCode} size={24} />
        ) : (
          <ThemeIcon iconName={'Globe'} size={24} />
        )}
        <View style={styles.currencyTextContainer}>
          <ThemeText
            styles={styles.currencyName}
            content={currency.info.name}
          />
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.currencyCode}
            content={currency.id}
          />
        </View>
        <CheckMarkCircle
          switchDarkMode={true}
          containerSize={20}
          isActive={isSelected}
        />
      </TouchableOpacity>
    );
  },
);

export default function FiatCurrencyPage() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { toggleFiatStats } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const currencies = useMemo(() => {
    return fiatCurrencies.sort((a, b) => a.id.localeCompare(b.id));
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
      <CurrencyItem
        currency={item}
        isSelected={item.id?.toLowerCase() === currentCurrency?.toLowerCase()}
        onSelect={saveCurrencySettings}
        theme={theme}
        darkModeType={darkModeType}
        backgroundOffset={backgroundOffset}
      />
    ),
    [
      currentCurrency,
      saveCurrencySettings,
      theme,
      darkModeType,
      backgroundOffset,
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
      />

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
  currencyRow: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 8,
    gap: 12,
  },
  currencyTextContainer: {
    flex: 1,
  },
  currencyName: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  currencyCode: {
    fontSize: SIZES.small,
    opacity: 0.6,
    includeFontPadding: false,
    marginTop: 2,
  },
});
