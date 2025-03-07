import {useEffect, useMemo, useRef, useState} from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useNavigation} from '@react-navigation/native';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  VALID_USERNAME_REGEX,
} from '../../../../../constants';

import {
  CustomKeyboardAvoidingView,
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
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ANDROIDSAFEAREA} from '../../../../../constants/styles';

export default function PosSettingsPage() {
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {isConnectedToTheInternet} = useAppStatus();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset, textColor, backgroundColor} = GetThemeColors();
  const navigate = useNavigation();

  const [textInput, setTextInput] = useState('');
  const [storeNameInput, setStoreNameInput] = useState(
    masterInfoObject?.posSettings?.storeName,
  );
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const insets = useSafeAreaInsets();

  const paddingBottom = Platform.select({
    ios: insets.bottom,
    android: ANDROIDSAFEAREA,
  });

  const savedCurrencies = masterInfoObject.fiatCurrenciesList || [];
  const currentCurrency = masterInfoObject?.posSettings?.storeCurrency;

  const CurrencyElements = useMemo(() => {
    return savedCurrencies
      .filter(currency => {
        if (
          currency.info.name
            .toLowerCase()
            .startsWith(textInput.toLocaleLowerCase()) ||
          currency.id.toLowerCase().startsWith(textInput.toLocaleLowerCase())
        )
          return currency;
        else return false;
      })
      .map((item, index) => {
        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.currencyContainer,

              {
                marginTop: index === 0 ? 10 : 0,
              },
            ]}
            onPress={() => {
              setTextInput('');
              savePOSSettings({storeCurrency: item.id}, 'currency');
              Keyboard.dismiss();
            }}>
            <ThemeText
              styles={{
                color: theme
                  ? item.id?.toLowerCase() === currentCurrency?.toLowerCase()
                    ? darkModeType
                      ? COLORS.opaicityGray
                      : COLORS.primary
                    : COLORS.darkModeText
                  : item.id?.toLowerCase() === currentCurrency?.toLowerCase()
                  ? COLORS.primary
                  : COLORS.lightModeText,
              }}
              content={`${item.id} - ${item.info.name}`}
            />
          </TouchableOpacity>
        );
      });
  }, [textInput, currentCurrency]);

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}>
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
      <ScrollView
        style={{flex: 1, width: '95%', ...CENTER}}
        contentContainerStyle={{
          paddingBottom: isKeyboardActive
            ? CONTENT_KEYBOARD_OFFSET
            : paddingBottom,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[1]}>
        <View style={{marginTop: 20, marginBottom: 10}}>
          <ThemeText content={'Store name'} />
          <CustomSearchInput
            setInputText={setStoreNameInput}
            inputText={storeNameInput}
            placeholderText={'Enter store name'}
            containerStyles={{marginTop: 10}}
            onBlurFunction={() => setIsKeyboardActive(false)}
            onFocusFunction={() => setIsKeyboardActive(true)}
            shouldDelayBlur={false}
          />
        </View>

        {/* Sticky Header Section */}
        <View style={{backgroundColor: backgroundColor, paddingVertical: 10}}>
          <ThemeText content={'Display currency'} />
          <CustomSearchInput
            inputText={textInput}
            setInputText={setTextInput}
            placeholderText={currentCurrency}
            containerStyles={{marginTop: 10}}
            onBlurFunction={() => setIsKeyboardActive(false)}
            onFocusFunction={() => setIsKeyboardActive(true)}
            shouldDelayBlur={false}
          />
        </View>
        {CurrencyElements}
      </ScrollView>

      <CustomButton
        buttonStyles={{
          width: '95%',
          maxWidth: 200,
          alignSelf: 'center',
          backgroundColor: theme ? COLORS.darkModeText : COLORS.primary,
        }}
        textStyles={{
          color: theme ? COLORS.lightModeText : COLORS.darkModeText,
        }}
        actionFunction={() => {
          if (
            masterInfoObject.posSettings.storeNameLower !==
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
          masterInfoObject.posSettings.storeName.toLowerCase() !==
          storeNameInput.toLowerCase()
            ? 'Save'
            : 'Open POS'
        }
      />
      <CustomButton
        buttonStyles={{
          width: '100%',
          marginTop: 20,
          backgroundColor: backgroundOffset,
          marginBottom: isKeyboardActive
            ? CONTENT_KEYBOARD_OFFSET
            : paddingBottom,
          ...CENTER,
        }}
        textStyles={{color: textColor}}
        actionFunction={() => {
          navigate.navigate('POSInstructionsPath');
        }}
        textContent={'Employee instructions'}
      />
    </CustomKeyboardAvoidingView>
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

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
