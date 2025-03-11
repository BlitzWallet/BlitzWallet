import {
  View,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Platform,
} from 'react-native';
import {Back_BTN} from '../../../components/login';
import {retrieveData, storeData} from '../../../functions';
import {CENTER, COLORS, FONT, SIZES} from '../../../constants';
import {useEffect, useRef, useState} from 'react';
import isValidMnemonic from '../../../functions/isValidMnemonic';
import {useTranslation} from 'react-i18next';
import {GlobalThemeView, ThemeText} from '../../../functions/CustomElements';
import SuggestedWordContainer from '../../../components/login/suggestedWords';
import CustomButton from '../../../functions/CustomElements/button';
import * as Clipboard from 'expo-clipboard';
import FullLoadingScreen from '../../../functions/CustomElements/loadingScreen';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ANDROIDSAFEAREA} from '../../../constants/styles';
import {WINDOWWIDTH} from '../../../constants/theme';
import {useGlobalThemeContext} from '../../../../context-store/theme';
import handleBackPressNew from '../../../hooks/handleBackPressNew';

const NUMARRAY = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function RestoreWallet({
  navigation: {navigate, reset},
  route: {params},
}) {
  handleBackPressNew();
  const {t} = useTranslation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const insets = useSafeAreaInsets();
  const bottomOffset = Platform.select({
    ios: insets.bottom,
    android: ANDROIDSAFEAREA,
  });
  const [isValidating, setIsValidating] = useState(false);
  const [currentFocused, setCurrentFocused] = useState(null);
  const keyRefs = useRef({});
  const [inputedKey, setInputedKey] = useState({
    key1: '',
    key2: '',
    key3: '',
    key4: '',
    key5: '',
    key6: '',
    key7: '',
    key8: '',
    key9: '',
    key10: '',
    key11: '',
    key12: '',
  });

  function handleInputElement(text, keyNumber) {
    setInputedKey(prev => ({...prev, [`key${keyNumber}`]: text}));
  }

  function handleFocus(keyNumber) {
    setCurrentFocused(keyNumber); // Update the current focused key
  }
  function handleSubmit(keyNumber) {
    if (keyNumber < 12) {
      const nextKey = keyNumber + 1;
      keyRefs.current[nextKey]?.focus(); // Focus the next input
    } else {
      keyRefs.current[12]?.blur(); // Blur the last input
    }
  }

  function createInputKeys() {
    let keyRows = [];
    let keyItem = [];
    NUMARRAY.forEach(item => {
      keyItem.push(
        <View
          key={item}
          style={{
            ...styles.seedItem,

            backgroundColor: theme
              ? COLORS.darkModeBackgroundOffset
              : COLORS.darkModeText,
          }}>
          <ThemeText styles={styles.numberText} content={`${item}.`} />
          <TextInput
            ref={ref => (keyRefs.current[item] = ref)} // Store ref for each input
            value={inputedKey[`key${item}`]}
            onFocus={() => handleFocus(item)} // Track the currently focused input
            onSubmitEditing={() => handleSubmit(item)} // Move to next input on submit
            onChangeText={e => handleInputElement(e, item)}
            blurOnSubmit={false}
            cursorColor={COLORS.lightModeText}
            style={styles.textInputStyle}
          />
        </View>,
      );
      if (item % 2 === 0) {
        keyRows.push(
          <View
            key={`row${item - 1}`}
            style={[styles.seedRow, {marginBottom: item !== 12 ? 10 : 0}]}>
            {keyItem}
          </View>,
        );
        keyItem = [];
      }
    });
    return keyRows;
  }

  const keyElements = createInputKeys();

  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setCurrentFocused(null);
      },
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, []);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        console.log('RUNNING');
        Keyboard.dismiss();
      }}
      style={{flex: 1}}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : null}
        style={{flex: 1}}>
        <GlobalThemeView styles={{paddingBottom: 0}}>
          {isValidating ? (
            <FullLoadingScreen text={t('constants.validating')} />
          ) : (
            <>
              <View
                style={{
                  flex: 1,
                  width: WINDOWWIDTH,
                  ...CENTER,
                }}>
                <Back_BTN
                  navigation={navigate}
                  destination={params ? params.goBackName : 'Home'}
                />

                <ThemeText
                  styles={{...styles.headerText}}
                  content={
                    params
                      ? t('createAccount.verifyKeyPage.header')
                      : t('createAccount.restoreWallet.home.header')
                  }
                />

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={styles.contentContainer}
                  contentContainerStyle={{paddingBottom: 10}}>
                  {keyElements}
                </ScrollView>
                {params && !currentFocused && (
                  <CustomButton
                    buttonStyles={styles.pasteButton}
                    textContent={t('constants.paste')}
                    actionFunction={getClipboardText}
                  />
                )}
                {!currentFocused && (
                  <View
                    style={{
                      ...styles.mainBTCContainer,
                      paddingBottom: bottomOffset,
                    }}>
                    <CustomButton
                      buttonStyles={{
                        width: 145,
                        marginRight: 10,
                      }}
                      textStyles={{
                        color: COLORS.lightModeText,
                      }}
                      textContent={params ? t('constants.skip') : 'Paste'}
                      actionFunction={() =>
                        params
                          ? navigate('PinSetup', {isInitialLoad: true})
                          : getClipboardText()
                      }
                    />
                    <CustomButton
                      buttonStyles={{
                        width: 145,
                        backgroundColor: COLORS.primary,
                      }}
                      textStyles={{
                        color: COLORS.darkModeText,
                      }}
                      textContent={params ? t('constants.verify') : 'Restore'}
                      actionFunction={
                        params ? didEnterCorrectSeed : keyValidation
                      }
                    />
                  </View>
                )}
              </View>

              {currentFocused && (
                <SuggestedWordContainer
                  inputedKey={inputedKey}
                  setInputedKey={setInputedKey}
                  selectedKey={currentFocused}
                  keyRefs={keyRefs}
                />
              )}
            </>
          )}
        </GlobalThemeView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );

  async function getClipboardText() {
    const data = await Clipboard.getStringAsync();
    if (!data) return;
    const splitSeed = data.split(' ');
    if (!splitSeed.every(word => word.trim().length > 0)) return;
    if (splitSeed.length != 12) return;
    console.log(Object.entries(inputedKey));

    const newKeys = Object.entries(inputedKey).reduce((acc, key) => {
      const index = Object.entries(acc).length;
      acc[key[0]] = splitSeed[index];
      return acc;
    }, {});

    setInputedKey(newKeys);
  }

  async function didEnterCorrectSeed() {
    const keys = await retrieveData('mnemonic');
    const didEnterAllKeys =
      Object.keys(inputedKey).filter(value => inputedKey[value]).length === 12;

    if (!didEnterAllKeys) {
      navigate('ErrorScreen', {
        errorMessage: t('createAccount.restoreWallet.home.error1'),
      });

      return;
    }
    const enteredMnemonic = Object.values(inputedKey).map(val =>
      val.trim().toLowerCase(),
    );
    const savedMnemonic = keys.split(' ').filter(item => item);

    if (JSON.stringify(savedMnemonic) === JSON.stringify(enteredMnemonic)) {
      navigate('PinSetup', {didRestoreWallet: true});
    } else {
      navigate('ErrorScreen', {
        errorMessage: t('createAccount.restoreWallet.home.error3'),
      });
    }
  }

  async function keyValidation() {
    setIsValidating(true);
    const enteredKeys =
      Object.keys(inputedKey).filter(value => inputedKey[value]).length === 12;

    if (!enteredKeys) {
      setIsValidating(false);
      navigate('ErrorScreen', {
        errorMessage: t('createAccount.restoreWallet.home.error1'),
      });
      return;
    }
    const mnemonic = Object.values(inputedKey).map(val =>
      val.trim().toLowerCase(),
    );

    const hasAccount = await isValidMnemonic(mnemonic);
    const hasPin = await retrieveData('pin');

    if (!hasAccount) {
      setIsValidating(false);
      navigate('ErrorScreen', {
        errorMessage: t('createAccount.restoreWallet.home.error2'),
      });
      return;
    } else {
      storeData('mnemonic', mnemonic.join(' '));
      if (hasPin) {
        reset({
          index: 0,
          routes: [
            {
              name: 'ConnectingToNodeLoadingScreen',
              params: {
                isInitialLoad: true,
                didRestoreWallet: true,
              },
            },
          ],
        });
      } else navigate('PinSetup', {didRestoreWallet: true});
    }
  }
}

const styles = StyleSheet.create({
  headerText: {
    width: '95%',
    fontSize: SIZES.xLarge,
    textAlign: 'center',
    marginBottom: 30,
    ...CENTER,
  },
  contentContainer: {
    flex: 1,
    width: '90%',
    ...CENTER,
  },
  pasteButton: {
    width: 145,
    backgroundColor: 'transparent',
    borderWidth: 1,
    marginTop: 20,
    marginBottom: 20,
    ...CENTER,
  },
  pasteButtonRestore: {
    width: 145,
    backgroundColor: 'transparent',
    borderWidth: 1,
    marginRight: 10,
  },
  seedRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  seedItem: {
    width: '48%',
    paddingVertical: Platform.OS === 'ios' ? 10 : 0,
    minHeight: Platform.OS === 'ios' ? 0 : 55,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  numberText: {
    fontSize: SIZES.large,
    includeFontPadding: false,
    marginRight: 10,
  },
  textInputStyle: {
    flex: 1,
    minHeight: Platform.OS === 'ios' ? 0 : 55,
    fontSize: SIZES.large,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
    color: COLORS.lightModeText,
  },

  mainBTCContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    ...CENTER,
  },
});
