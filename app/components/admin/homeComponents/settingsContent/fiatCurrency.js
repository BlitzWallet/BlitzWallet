import { FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, CONTENT_KEYBOARD_OFFSET } from '../../../../constants';
import { useMemo, useState } from 'react';
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
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import loadNewFiatData from '../../../../functions/saveAndUpdateFiatData';
import { fiatCurrencies } from '../../../../functions/currencyOptions';
import { useKeysContext } from '../../../../../context-store/keys';
import GetThemeColors from '../../../../hooks/themeColors';
import { keyboardGoBack } from '../../../../functions/customNavigation';

export default function FiatCurrencyPage() {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { toggleFiatStats } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const currencies = useMemo(() => {
    return fiatCurrencies.sort((a, b) => a.id.localeCompare(b.id));
  }, []);

  const [textInput, setTextInput] = useState('');
  const currentCurrency = masterInfoObject?.fiatCurrency;
  const { t } = useTranslation();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const { bottomPadding } = useGlobalInsets();
  const { backgroundColor } = GetThemeColors();
  const navigate = useNavigation();

  const [isLoading, setIsLoading] = useState(false);

  const filteredList = currencies.filter(currency => {
    if (
      currency.info.name.toLowerCase().includes(textInput.toLowerCase()) ||
      currency.id.toLowerCase().startsWith(textInput.toLowerCase())
    )
      return currency;
    else return false;
  });

  const CurrencyElements = ({ currency, id }) => {
    return (
      <TouchableOpacity
        style={[
          styles.currencyContainer,
          {
            marginTop: id === 0 ? 10 : 0,
          },
        ]}
        onPress={() => {
          saveCurrencySettings(currency.id);
        }}
      >
        <CheckMarkCircle
          isActive={
            currency.id?.toLowerCase() === currentCurrency?.toLowerCase()
          }
          containerSize={25}
        />
        <ThemeText
          CustomNumberOfLines={1}
          styles={{
            color: theme
              ? currency.id?.toLowerCase() === currentCurrency?.toLowerCase()
                ? darkModeType
                  ? COLORS.darkModeText
                  : COLORS.primary
                : COLORS.darkModeText
              : currency.id?.toLowerCase() === currentCurrency?.toLowerCase()
              ? COLORS.primary
              : COLORS.lightModeText,
            marginLeft: 10,
            flexShrink: 1,
            includeFontPadding: false,
          }}
          content={`${currency.id} - ${currency.info.name}`}
        />
      </TouchableOpacity>
    );
  };

  const memorizedKeyboardStyle = useMemo(() => {
    return {
      paddingBottom: !isKeyboardActive ? CONTENT_KEYBOARD_OFFSET : 0,
    };
  }, [isKeyboardActive]);

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
      globalThemeViewStyles={memorizedKeyboardStyle}
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={t('settings.fiatCurrency.title')}
      />

      <FlatList
        style={{
          width: '100%',
          maxWidth: MAX_CONTENT_WIDTH,
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 20,
          paddingBottom: bottomPadding,
        }}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <CustomSearchInput
            setInputText={setTextInput}
            inputText={textInput}
            placeholderText={t('settings.fiatCurrency.placeholderText')}
            containerStyles={{
              backgroundColor,
              width: INSET_WINDOW_WIDTH,
              paddingBottom: CONTENT_KEYBOARD_OFFSET,
            }}
            onBlurFunction={() => setIsKeyboardActive(false)}
            onFocusFunction={() => setIsKeyboardActive(true)}
          />
        }
        data={filteredList}
        renderItem={({ item, index }) => (
          <CurrencyElements id={index} currency={item} />
        )}
        keyExtractor={currency => currency.id}
        showsVerticalScrollIndicator={false}
      />
    </CustomKeyboardAvoidingView>
  );

  async function saveCurrencySettings(selectedCurrency) {
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
      keyboardGoBack(navigate);
    } catch (err) {
      setIsLoading(false);
      console.log(err);
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.fiatCurrency.saveCurrencyError'),
      });
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  currencyContainer: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 'auto',
    marginLeft: 'auto',
    marginTop: 10,

    paddingVertical: 10,
  },
});
