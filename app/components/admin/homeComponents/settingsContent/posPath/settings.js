import {useEffect, useRef, useState} from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useNavigation} from '@react-navigation/native';
import {
  CENTER,
  COLORS,
  ICONS,
  VALID_USERNAME_REGEX,
} from '../../../../../constants';
import {FONT, SIZES, WINDOWWIDTH} from '../../../../../constants/theme';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import {canUsePOSName} from '../../../../../../db';
import openWebBrowser from '../../../../../functions/openWebBrowser';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {useAppStatus} from '../../../../../../context-store/appStatus';

export default function PosSettingsPage() {
  const isInitialRender = useRef(true);
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {isConnectedToTheInternet} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const currentCurrency = masterInfoObject?.posSettings?.storeCurrency;
  const [currencies, setCurrencies] = useState([]);
  const [textInput, setTextInput] = useState(currentCurrency);
  const [listData, setListData] = useState([]);
  const [storeNameInput, setStoreNameInput] = useState(
    masterInfoObject?.posSettings?.storeName,
  );

  const {backgroundOffset, textColor} = GetThemeColors();

  const navigate = useNavigation();

  useEffect(() => {
    if (isInitialRender.current) {
      const savedCurrencies = masterInfoObject.fiatCurrenciesList || [];

      setCurrencies(savedCurrencies);
      setListData(savedCurrencies);

      isInitialRender.current = false;
    } else {
      if (!textInput) {
        setListData(currencies);
        return;
      }
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
      setListData(filteredList);
    }
  }, [textInput]);

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
          setTextInput('');
          savePOSSettings({storeCurrency: currency.id}, 'currency');
          Keyboard.dismiss();
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
    <GlobalThemeView useStandardWidth={true}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : null}
        style={styles.container}>
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={{flex: 1, width: '95%', ...CENTER}}>
            <CustomSettingsTopBar
              shouldDismissKeyboard={true}
              showLeftImage={true}
              leftImageBlue={ICONS.receiptIcon}
              LeftImageDarkMode={ICONS.receiptWhite}
              containerStyles={{marginBottom: 0}}
              label={'Point-of-sale'}
              leftImageFunction={() => {
                Keyboard.dismiss();

                if (!isConnectedToTheInternet) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage: 'Please reconnect to the internet',
                  });
                  return;
                }
                navigate.navigate('ViewPOSTransactions');
              }}
            />
            <ThemeText styles={{marginTop: 20}} content={'Store name'} />
            <CustomSearchInput
              setInputText={setStoreNameInput}
              inputText={storeNameInput}
              placeholderText={'Enter store name'}
              containerStyles={{marginTop: 10}}
            />

            <ThemeText styles={{marginTop: 10}} content={'Display currency'} />
            <CustomSearchInput
              inputText={textInput}
              setInputText={setTextInput}
              placeholderText={currentCurrency}
              containerStyles={{marginTop: 10}}
            />

            <FlatList
              style={{
                flex: 1,
                width: '100%',
              }}
              data={listData}
              renderItem={({item, index}) => (
                <CurrencyElements id={index} currency={item} />
              )}
              keyExtractor={currency => currency.id}
              showsVerticalScrollIndicator={false}
            />

            <CustomButton
              buttonStyles={{
                width: '100%',
                marginTop: 'auto',
                backgroundColor: backgroundOffset,
              }}
              textStyles={{color: textColor}}
              actionFunction={() => {
                navigate.navigate('POSInstructionsPath');
              }}
              textContent={'See employee instructions'}
            />
            <CustomButton
              buttonStyles={{
                width: '65%',
                marginTop: 20,
                ...CENTER,
                backgroundColor: theme ? COLORS.darkModeText : COLORS.primary,
              }}
              textStyles={{
                color: theme ? COLORS.lightModeText : COLORS.darkModeText,
              }}
              actionFunction={() => {
                if (
                  masterInfoObject.posSettings.storeNameLower !=
                  storeNameInput.toLowerCase()
                ) {
                  savePOSSettings(
                    {
                      storeName: storeNameInput.trim(),
                      storeNameLower: storeNameInput.trim().toLowerCase(),
                    },
                    'storeName',
                  );
                  return;
                } else {
                  openWebBrowser({
                    navigate,
                    link: `https://pay.blitz-wallet.com/${masterInfoObject.posSettings.storeName}`,
                  });
                }
              }}
              textContent={
                masterInfoObject.posSettings.storeName.toLowerCase() !=
                storeNameInput.toLowerCase()
                  ? 'Save'
                  : 'Open POS'
              }
            />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </GlobalThemeView>
  );

  async function savePOSSettings(newData, type) {
    if (type === 'storeName') {
      if (
        newData.storeNameLower === masterInfoObject.posSettings.storeNameLower
      ) {
        navigate.navigate('ErrorScreen', {errorMessage: 'Name already in use'});
        return;
      }
      if (!VALID_USERNAME_REGEX.test(newData.storeNameLower)) {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Name can only include letters and numbers. ',
        });
        return;
      }

      const isValidPosName = await canUsePOSName(
        'blitzWalletUsers',
        newData.storeNameLower,
      );
      if (!isValidPosName) {
        navigate.navigate('ErrorScreen', {errorMessage: 'Name already taken'});
        setStoreNameInput(masterInfoObject.posSettings.storeName);
        return;
      }
    }
    toggleMasterInfoObject({
      posSettings: {
        ...masterInfoObject.posSettings,
        ...newData,
      },
    });
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  currencyContainer: {
    width: '100%',

    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 'auto',
    marginLeft: 'auto',
    marginTop: 10,

    paddingVertical: 10,
  },

  errorText: {
    color: 'black',
    fontFamily: FONT.Title_Bold,
    fontSize: SIZES.large,
    marginTop: 'auto',
    marginBottom: 'auto',
  },

  currencyTitle: {
    width: '100%',
    flex: 1,
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Bold,
  },
  currencyID: {
    fontSize: SIZES.small,
    fontFamily: FONT.Descriptoin_Regular,
    marginLeft: 10,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarText: {
    fontSize: SIZES.xLarge,
    width: '100%',
    textAlign: 'center',
    fontFamily: FONT.Title_Regular,
  },
});
