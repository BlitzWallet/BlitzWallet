import {
  Keyboard,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import {ICONS, WEBSITE_REGEX} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {useRef, useState} from 'react';
import {CENTER, KEYBOARDTIMEOUT} from '../../../../constants/styles';
import {SIZES} from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {useTranslation} from 'react-i18next';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import {crashlyticsLogReport} from '../../../../functions/crashlyticsLogs';
import testURLForInvoice from '../../../../functions/testURLForInvoice';

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
            content={'Enter in destination'}
          />
          <TouchableOpacity
            onPress={() => {
              navigate.navigate('InformationPopup', {
                textContent:
                  'Blitz wallet can send to liquid, on-chain, LNURL and BOLT 11 addresses',
                buttonText: 'I understand',
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
          textContent={'Continue'}
        />
      </View>
    </TouchableWithoutFeedback>
  );
  function hanldeSubmit() {
    if (!inputValue) return;
    crashlyticsLogReport(
      'Running in custom enter send adddress submit function',
    );
    Keyboard.dismiss();
    const formattedInput = inputValue.trim();
    setTimeout(
      () => {
        let btcAddress;
        if (WEBSITE_REGEX.test(formattedInput)) {
          const invoice = testURLForInvoice(formattedInput);
          if (!invoice) {
            navigate.navigate('CustomWebView', {
              headerText: '',
              webViewURL: formattedInput,
            });
            return;
          }
          btcAddress = invoice;
        }
        navigate.replace('ConfirmPaymentScreen', {
          btcAdress: btcAddress || formattedInput,
        });
      },
      Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0,
    );
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
