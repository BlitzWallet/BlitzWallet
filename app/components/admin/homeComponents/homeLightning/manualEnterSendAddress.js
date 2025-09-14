import {
  Keyboard,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import {ICONS} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {useRef, useState} from 'react';
import {CENTER, KEYBOARDTIMEOUT} from '../../../../constants/styles';
import {SIZES} from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {useTranslation} from 'react-i18next';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import {crashlyticsLogReport} from '../../../../functions/crashlyticsLogs';
import handlePreSendPageParsing from '../../../../functions/sendBitcoin/handlePreSendPageParsing';

export default function ManualEnterSendAddress(props) {
  const navigate = useNavigation();
  const {t} = useTranslation();
  const {setIsKeyboardActive, setContentHeight, theme, darkModeType} = props;
  const initialValue = useRef(0);

  const [inputValue, setInputValue] = useState('');

  return (
    <TouchableWithoutFeedback
      onLayout={e => {
        const {height} = e.nativeEvent.layout;
        if (!initialValue.current) {
          initialValue.current = height;
          setContentHeight(height);
        }
      }}>
      <View style={styles.popupContainer}>
        <View style={styles.informationContainer}>
          <ThemeText
            styles={styles.textInputLabel}
            content={t('wallet.homeLightning.manualEnterSendAddress.title')}
          />
          <TouchableOpacity
            onPress={() => {
              navigate.navigate('InformationPopup', {
                textContent: t(
                  'wallet.homeLightning.manualEnterSendAddress.paymentTypesDesc',
                ),
                buttonText: t('constants.understandText'),
              });
            }}>
            <ThemeImage
              styles={{width: 20, height: 20}}
              lightsOutIcon={ICONS.aboutIconWhite}
              lightModeIcon={ICONS.aboutIcon}
              darkModeIcon={ICONS.aboutIcon}
            />
          </TouchableOpacity>
        </View>
        <CustomSearchInput
          textInputMultiline={true}
          inputText={inputValue}
          setInputText={setInputValue}
          textInputStyles={styles.testInputStyle}
          containerStyles={styles.textInputContianerSyles}
          textAlignVertical={'top'}
          onBlurFunction={() => setIsKeyboardActive(false)}
          onFocusFunction={() => setIsKeyboardActive(true)}
          shouldDelayBlur={false}
        />
        <CustomButton
          buttonStyles={{
            ...styles.buttonContainer,
            opacity: !inputValue ? 0.5 : 1,
          }}
          actionFunction={hanldeSubmit}
          textContent={t('constants.continue')}
        />
      </View>
    </TouchableWithoutFeedback>
  );
  function hanldeSubmit() {
    if (!inputValue) return;
    crashlyticsLogReport(
      'Running in custom enter send adddress submit function',
    );
    const formattedInput = inputValue.trim();
    setTimeout(
      () => {
        const response = handlePreSendPageParsing(formattedInput);

        if (response.error) {
          navigate.navigate('ErrorScreen', {errorMessage: response.error});
          return;
        }

        if (response.navigateToWebView) {
          navigate.navigate('CustomWebView', {
            headerText: '',
            webViewURL: response.webViewURL,
          });
          return;
        }
        navigate.replace('ConfirmPaymentScreen', {
          btcAdress: response.btcAdress,
        });
      },
      Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0,
    );
    Keyboard.dismiss();
  }
}

const styles = StyleSheet.create({
  popupContainer: {
    flex: 1,
    width: '90%',
    justifyContent: 'center',
    ...CENTER,
  },
  informationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  textInputLabel: {
    marginRight: 10,
    fontWeight: 400,
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  buttonContainer: {
    marginTop: 20,
    ...CENTER,
  },
  textInputContianerSyles: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testInputStyle: {
    flex: 1,
    maxHeight: 150,
  },
});
