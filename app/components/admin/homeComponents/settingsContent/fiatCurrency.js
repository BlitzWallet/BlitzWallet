import {
  FlatList,
  StyleSheet,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {CENTER, COLORS} from '../../../../constants';
import {fetchFiatRates} from '@breeztech/react-native-breez-sdk-liquid';
import {useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {GlobalThemeView, ThemeText} from '../../../../functions/CustomElements';
import {WINDOWWIDTH} from '../../../../constants/theme';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useNodeContext} from '../../../../../context-store/nodeContext';

export default function FiatCurrencyPage() {
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {toggleNodeInformation} = useNodeContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const currencies = masterInfoObject.fiatCurrenciesList || [];
  const [textInput, setTextInput] = useState('');
  const currentCurrency = masterInfoObject?.fiatCurrency;

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
            marginBottom: id === currencies.length - 1 ? 30 : 0,
            marginTop: id === 0 ? 10 : 0,
          },
        ]}
        onPress={() => {
          saveCurrencySettings(currency.id);
        }}>
        <ThemeText
          styles={{
            color: theme
              ? currency.id?.toLowerCase() === currentCurrency?.toLowerCase()
                ? darkModeType
                  ? COLORS.opaicityGray
                  : COLORS.primary
                : COLORS.darkModeText
              : currency.id?.toLowerCase() === currentCurrency?.toLowerCase()
              ? COLORS.primary
              : COLORS.lightModeText,
          }}
          content={`${currency.id} - ${currency.info.name}`}
        />
      </TouchableOpacity>
    );
  };

  return (
    <GlobalThemeView styles={{paddingBottom: 0}}>
      <View style={styles.outerContainer}>
        <CustomSettingsTopBar
          shouldDismissKeyboard={true}
          label={'Display Currency'}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : null}
          style={styles.container}>
          <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
            <>
              <CustomSearchInput
                setInputText={setTextInput}
                inputText={textInput}
                placeholderText={'Search currency'}
                containerStyles={{width: '90%', marginTop: 20}}
              />

              {isLoading ? (
                <FullLoadingScreen />
              ) : (
                <FlatList
                  style={{flex: 1, width: '100%'}}
                  data={filteredList}
                  renderItem={({item, index}) => (
                    <CurrencyElements id={index} currency={item} />
                  )}
                  keyExtractor={currency => currency.id}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </View>
    </GlobalThemeView>
  );

  async function saveCurrencySettings(selectedCurrency) {
    try {
      setIsLoading(true);
      toggleMasterInfoObject({fiatCurrency: selectedCurrency});
      const fiat = await fetchFiatRates();
      const [fiatRate] = fiat.filter(rate => {
        return rate.coin.toLowerCase() === selectedCurrency.toLowerCase();
      });
      toggleNodeInformation({fiatStats: fiatRate});

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
  outerContainer: {
    flex: 1,
    width: WINDOWWIDTH,
    ...CENTER,
  },

  container: {
    flex: 1,
  },

  currencyContainer: {
    width: '85%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 'auto',
    marginLeft: 'auto',
    marginTop: 10,

    paddingVertical: 10,
  },
});
