import {FlatList, StyleSheet, TouchableOpacity} from 'react-native';
import {COLORS, CONTENT_KEYBOARD_OFFSET} from '../../../../constants';
import {fetchFiatRates} from '@breeztech/react-native-breez-sdk-liquid';
import {useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import {useGlobalInsets} from '../../../../../context-store/insetsProvider';

export default function FiatCurrencyPage() {
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {toggleFiatStats} = useNodeContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const currencies = masterInfoObject.fiatCurrenciesList || [];
  const [textInput, setTextInput] = useState('');
  const currentCurrency = masterInfoObject?.fiatCurrency;

  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const {bottomPadding} = useGlobalInsets();

  const navigate = useNavigation();

  const [isLoading, setIsLoading] = useState(false);

  const filteredList = currencies.filter(currency => {
    if (
      currency.info.name
        .toLowerCase()
        .startsWith(textInput.toLocaleLowerCase()) ||
      currency.id.toLowerCase().startsWith(textInput.toLocaleLowerCase())
    )
      return currency;
    else return false;
  });

  const CurrencyElements = ({currency, id}) => {
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
        }}>
        <CheckMarkCircle
          isActive={
            currency.id?.toLowerCase() === currentCurrency?.toLowerCase()
          }
          containerSize={25}
        />
        <ThemeText
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
          }}
          content={`${currency.id} - ${currency.info.name}`}
        />
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar
          shouldDismissKeyboard={true}
          label={'Display Currency'}
        />
        <FullLoadingScreen />
      </GlobalThemeView>
    );
  }

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}>
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={'Display Currency'}
      />

      <FlatList
        style={{width: '100%'}}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 20,
          paddingBottom: isKeyboardActive
            ? CONTENT_KEYBOARD_OFFSET
            : bottomPadding,
        }}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <CustomSearchInput
            setInputText={setTextInput}
            inputText={textInput}
            placeholderText={'Search currency'}
            containerStyles={{width: INSET_WINDOW_WIDTH}}
            onBlurFunction={() => setIsKeyboardActive(false)}
            onFocusFunction={() => setIsKeyboardActive(true)}
          />
        }
        data={filteredList}
        renderItem={({item, index}) => (
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
      toggleMasterInfoObject({fiatCurrency: selectedCurrency});
      const fiat = await fetchFiatRates();
      const [fiatRate] = fiat.filter(rate => {
        return rate.coin.toLowerCase() === selectedCurrency.toLowerCase();
      });

      toggleFiatStats(fiatRate);

      if (fiatRate) {
        navigate.goBack();
      } else {
        navigate.navigate('ErrorScreen', {
          errorMessage:
            'Sorry, we were not able to save the selected currency.',
        });
      }
    } catch (err) {
      setIsLoading(false);
      console.log(err);
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Sorry, we ran into an error when saving this currency.',
      });
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  currencyContainer: {
    width: '85%',
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 'auto',
    marginLeft: 'auto',
    marginTop: 10,

    paddingVertical: 10,
  },
});
