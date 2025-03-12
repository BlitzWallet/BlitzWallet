import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import {
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  WEBSITE_REGEX,
} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {useState} from 'react';
import {
  ANDROIDSAFEAREA,
  CENTER,
  KEYBOARDTIMEOUT,
} from '../../../../constants/styles';
import {SIZES} from '../../../../constants/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import {useTranslation} from 'react-i18next';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import GetThemeColors from '../../../../hooks/themeColors';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

export default function ManualEnterSendAddress() {
  const navigate = useNavigation();
  const {t} = useTranslation();
  const {backgroundOffset} = GetThemeColors();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const insets = useSafeAreaInsets();
  const paddingBottom = Platform.select({
    ios: insets.bottom,
    android: ANDROIDSAFEAREA,
  });

  const [inputValue, setInputValue] = useState('');

  return (
    <TouchableWithoutFeedback>
      <View
        style={{
          ...styles.popupContainer,
          paddingBottom: isKeyboardActive
            ? CONTENT_KEYBOARD_OFFSET
            : paddingBottom,
        }}>
        <View
          style={[
            styles.topBar,
            {
              backgroundColor: backgroundOffset,
            },
          ]}
        />
        <ScrollView
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.innerContainer}
          style={{width: '100%', flexGrow: 1}}>
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
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
  function hanldeSubmit() {
    if (!inputValue) return;
    Keyboard.dismiss();
    setTimeout(
      () => {
        if (WEBSITE_REGEX.test(inputValue)) {
          navigate.navigate('CustomWebView', {
            headerText: '',
            webViewURL: inputValue,
          });
          return;
        }
        navigate.replace('ConfirmPaymentScreen', {
          btcAdress: inputValue,
        });
      },
      Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0,
    );
  }
}

const styles = StyleSheet.create({
  popupContainer: {
    width: '100%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  informationContainer: {
    width: '100%',
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
    marginTop: 'auto',
    ...CENTER,
  },
  topBar: {
    width: 120,
    height: 8,
    marginTop: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  innerContainer: {
    width: '90%',
    justifyContent: 'center',
    ...CENTER,
  },
  textInputContianerSyles: {
    width: '100%',
    marginBottom: 10,
  },
  testInputStyle: {
    height: 150,
  },
});
