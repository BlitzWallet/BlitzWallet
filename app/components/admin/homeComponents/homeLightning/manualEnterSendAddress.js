import { Keyboard, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { CENTER, KEYBOARDTIMEOUT } from '../../../../constants/styles';
import { HIDDEN_OPACITY, SIZES } from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import handlePreSendPageParsing from '../../../../functions/sendBitcoin/handlePreSendPageParsing';
import { keyboardNavigate } from '../../../../functions/customNavigation';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function ManualEnterSendAddress(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { setIsKeyboardActive, setContentHeight, handleBackPressFunction } =
    props;
  const initialValue = useRef(0);
  const textInputRef = useRef(null);
  const didClickInfo = useRef(null);

  const [inputValue, setInputValue] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!textInputRef.current.isFocused()) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            textInputRef.current.focus();
          });
        });
      }
    }, []),
  );

  const handleTextInputBlur = () => {
    console.log(inputValue);
    setIsKeyboardActive(false);
    if (!inputValue && !didClickInfo.current) {
      handleBackPressFunction?.();
    }
    didClickInfo.current = false;
  };

  return (
    <View
      onLayout={e => {
        const { height } = e.nativeEvent.layout;
        if (!initialValue.current) {
          initialValue.current = height;
          setContentHeight(height);
        }
      }}
      style={styles.popupContainer}
    >
      <View style={styles.informationContainer}>
        <ThemeText
          styles={styles.textInputLabel}
          content={t('wallet.homeLightning.manualEnterSendAddress.title')}
        />
        <TouchableOpacity
          onPress={() => {
            didClickInfo.current = true;
            keyboardNavigate(() =>
              navigate.navigate('InformationPopup', {
                textContent: t(
                  'wallet.homeLightning.manualEnterSendAddress.paymentTypesDesc',
                ),
                buttonText: t('constants.understandText'),
              }),
            );
          }}
        >
          <ThemeIcon size={20} iconName={'Info'} />
        </TouchableOpacity>
      </View>
      <CustomSearchInput
        textInputRef={textInputRef}
        textInputMultiline={true}
        inputText={inputValue}
        setInputText={setInputValue}
        textInputStyles={styles.testInputStyle}
        containerStyles={styles.textInputContianerSyles}
        textAlignVertical={'top'}
        onBlurFunction={handleTextInputBlur}
        onFocusFunction={() => setIsKeyboardActive(true)}
        shouldDelayBlur={false}
      />
      <CustomButton
        buttonStyles={{
          ...styles.buttonContainer,
          opacity: !inputValue ? HIDDEN_OPACITY : 1,
        }}
        actionFunction={hanldeSubmit}
        textContent={t('constants.continue')}
      />
    </View>
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
          navigate.navigate('ErrorScreen', { errorMessage: response.error });
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
