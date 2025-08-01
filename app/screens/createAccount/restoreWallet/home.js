import {
  View,
  TextInput,
  StyleSheet,
  Keyboard,
  ScrollView,
  Platform,
} from 'react-native';
import {Back_BTN} from '../../../components/login';
import {CENTER, COLORS, FONT, SIZES} from '../../../constants';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import isValidMnemonic from '../../../functions/isValidMnemonic';
import {useTranslation} from 'react-i18next';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../functions/CustomElements';
import SuggestedWordContainer from '../../../components/login/suggestedWords';
import CustomButton from '../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../functions/CustomElements/loadingScreen';
import {WINDOWWIDTH} from '../../../constants/theme';
import {useGlobalThemeContext} from '../../../../context-store/theme';
import useHandleBackPressNew from '../../../hooks/useHandleBackPressNew';
import getClipboardText from '../../../functions/getClipboardText';
import {useNavigation} from '@react-navigation/native';
import {crashlyticsLogReport} from '../../../functions/crashlyticsLogs';
import {useKeysContext} from '../../../../context-store/keys';
import {wordlist} from '@scure/bip39/wordlists/english';
import {handleRestoreFromText} from '../../../functions/seed';
import {useGlobalInsets} from '../../../../context-store/insetsProvider';

const NUMARRAY = Array.from({length: 12}, (_, i) => i + 1);
const INITIAL_KEY_STATE = NUMARRAY.reduce((acc, num) => {
  acc[`key${num}`] = '';
  return acc;
}, {});

export default function RestoreWallet({navigation: {reset}, route: {params}}) {
  useHandleBackPressNew();
  const navigate = useNavigation();
  const {t} = useTranslation();
  const {accountMnemoinc, setAccountMnemonic} = useKeysContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {bottomPadding} = useGlobalInsets();
  const [isValidating, setIsValidating] = useState(false);
  const [currentFocused, setCurrentFocused] = useState(null);
  const keyRefs = useRef({});
  const [inputedKey, setInputedKey] = useState(INITIAL_KEY_STATE);

  // Helper functions
  const navigateToError = useCallback(
    errorMessage => {
      navigate.navigate('ErrorScreen', {errorMessage});
    },
    [navigate],
  );

  const handleInputElement = useCallback((text, keyNumber) => {
    const restoredSeed = handleRestoreFromText(text);
    const QRSeedResponse = handleCameraScan(text, true);

    if (
      (restoredSeed.didWork && restoredSeed?.seed?.length === 12) ||
      QRSeedResponse
    ) {
      const splitSeed = restoredSeed.didWork
        ? restoredSeed.seed
        : QRSeedResponse;
      const newKeys = {};
      NUMARRAY.forEach((num, index) => {
        newKeys[`key${num}`] = splitSeed[index];
      });
      setInputedKey(newKeys);
      return;
    }

    setInputedKey(prev => ({...prev, [`key${keyNumber}`]: text}));
  }, []);

  const handleFocus = useCallback(keyNumber => {
    setCurrentFocused(keyNumber); // Update the current focused key
  }, []);

  const handleSubmit = useCallback(
    keyNumber => {
      if (keyNumber < 12) {
        const nextKey = keyNumber + 1;
        keyRefs.current[nextKey]?.focus(); // Focus the next input
      } else {
        keyRefs.current[12]?.blur(); // Blur the last input
      }
    },
    [keyRefs],
  );

  const handleSeedFromClipboard = useCallback(async () => {
    try {
      crashlyticsLogReport('Starting paste seed from clipboard');
      const response = await getClipboardText();
      if (!response.didWork) throw new Error(response.reason);

      const data = response.data;

      const restoredSeed = handleRestoreFromText(data);

      if (!restoredSeed.didWork || !restoredSeed?.seed?.length) {
        const QRSeedResponse = handleCameraScan(data);
        if (QRSeedResponse) return;
        throw new Error('Unable to find seed in string');
      }

      const splitSeed = restoredSeed.seed;
      console.log(splitSeed);

      if (!splitSeed.every(word => word.trim().length > 0))
        throw new Error('Not every word is of valid length');

      if (splitSeed.length != 12)
        throw new Error('Unable to find 12 words from copied recovery phrase.');
      console.log(Object.entries(inputedKey));

      const newKeys = {};
      NUMARRAY.forEach((num, index) => {
        newKeys[`key${num}`] = splitSeed[index];
      });
      setInputedKey(newKeys);
    } catch (err) {
      console.log('Error getting data from clipbarod', err);
      navigateToError(err.message);
    }
  }, [navigateToError]);

  const didEnterCorrectSeed = useCallback(async () => {
    crashlyticsLogReport('Starting seed check');
    try {
      const keys = accountMnemoinc;
      const didEnterAllKeys =
        Object.keys(inputedKey).filter(value => inputedKey[value]).length ===
        12;

      if (!didEnterAllKeys)
        throw new Error(t('createAccount.restoreWallet.home.error1'));
      const enteredMnemonic = Object.values(inputedKey).map(val =>
        val.trim().toLowerCase(),
      );
      const savedMnemonic = keys.split(' ').filter(item => item);

      if (JSON.stringify(savedMnemonic) === JSON.stringify(enteredMnemonic)) {
        navigate.navigate('PinSetup', {didRestoreWallet: true});
      } else throw new Error(t('createAccount.restoreWallet.home.error3'));
    } catch (err) {
      console.log('did enter correct seed error', err);
      navigateToError(err.message);
    }
  }, [inputedKey, navigateToError]);

  const keyValidation = useCallback(async () => {
    crashlyticsLogReport('Starting past seed validation');
    try {
      setIsValidating(true);
      const enteredKeys =
        Object.keys(inputedKey).filter(value => inputedKey[value]).length ===
        12;

      if (!enteredKeys)
        throw new Error(t('createAccount.restoreWallet.home.error1'));

      const mnemonic = Object.values(inputedKey).map(val =>
        val.trim().toLowerCase(),
      );

      const hasAccount = isValidMnemonic(mnemonic);

      if (!hasAccount)
        throw new Error(t('createAccount.restoreWallet.home.error2'));
      else {
        setAccountMnemonic(mnemonic.join(' '));
        navigate.navigate('PinSetup', {didRestoreWallet: true});
      }
    } catch (err) {
      console.log('key validation error', err);
      navigateToError(err.message);
    } finally {
      setIsValidating(false);
    }
  }, [inputedKey, reset, navigate, navigateToError, t]);

  const handleCameraScan = (data, localTry = false) => {
    try {
      if (!data) return;
      let indexMnemonic = [];

      for (let index = 0; index < 12; index++) {
        const start = index * 4;
        const end = start + 4;
        indexMnemonic.push(data.slice(start, end));
      }
      const seedMnemoinc = indexMnemonic
        .map(item => {
          if (isNaN(Number(item))) return false;
          return wordlist.at(Number(item));
        })
        .filter(Boolean);
      if (seedMnemoinc.length !== 12)
        throw new Error('Unable to find seed in number array');
      const newKeys = {};
      NUMARRAY.forEach((num, index) => {
        newKeys[`key${num}`] = seedMnemoinc[index];
      });
      setInputedKey(newKeys);
      return true;
    } catch (err) {
      console.log('error getting seed from camera', err);
      if (localTry) return false;
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Unable to get seed from QR code',
      });
    }
  };

  const seedItemBackgroundColor = useMemo(
    () => (theme ? COLORS.darkModeBackgroundOffset : COLORS.darkModeText),
    [theme],
  );

  const inputKeys = useMemo(() => {
    const rows = [];

    // Process input fields in pairs
    for (let i = 0; i < NUMARRAY.length; i += 2) {
      const item1 = NUMARRAY[i];
      const item2 = NUMARRAY[i + 1];

      rows.push(
        <View
          key={`row${item1}`}
          style={[styles.seedRow, {marginBottom: item2 !== 12 ? 10 : 0}]}>
          {/* First item in row */}
          <View
            style={[
              styles.seedItem,
              {backgroundColor: seedItemBackgroundColor},
            ]}>
            <ThemeText styles={styles.numberText} content={`${item1}.`} />
            <TextInput
              autoCorrect={false}
              autoComplete="off"
              autoCapitalize="none"
              keyboardAppearance={theme ? 'dark' : 'light'}
              ref={ref => (keyRefs.current[item1] = ref)}
              value={inputedKey[`key${item1}`]}
              onFocus={() => handleFocus(item1)}
              onSubmitEditing={() => handleSubmit(item1)}
              onChangeText={e => handleInputElement(e, item1)}
              blurOnSubmit={false}
              cursorColor={COLORS.lightModeText}
              style={styles.textInputStyle}
            />
          </View>

          {/* Second item in row */}
          <View
            style={[
              styles.seedItem,
              {backgroundColor: seedItemBackgroundColor},
            ]}>
            <ThemeText styles={styles.numberText} content={`${item2}.`} />
            <TextInput
              keyboardAppearance={theme ? 'dark' : 'light'}
              ref={ref => (keyRefs.current[item2] = ref)}
              value={inputedKey[`key${item2}`]}
              onFocus={() => handleFocus(item2)}
              onSubmitEditing={() => handleSubmit(item2)}
              onChangeText={e => handleInputElement(e, item2)}
              blurOnSubmit={false}
              cursorColor={COLORS.lightModeText}
              style={styles.textInputStyle}
            />
          </View>
        </View>,
      );
    }

    return rows;
  }, [
    handleFocus,
    handleSubmit,
    handleInputElement,
    theme,
    inputedKey,
    seedItemBackgroundColor,
  ]);

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

  if (isValidating) {
    return <FullLoadingScreen text={t('constants.validating')} />;
  }

  return (
    <CustomKeyboardAvoidingView
      touchableWithoutFeedbackFunction={Keyboard.dismiss}
      useLocalPadding={false}
      useTouchableWithoutFeedback={true}>
      <View style={styles.keyContainer}>
        <View style={styles.navContainer}>
          <Back_BTN />
        </View>
        <ThemeText
          styles={styles.headerText}
          content={
            params
              ? t('createAccount.verifyKeyPage.header')
              : t('createAccount.restoreWallet.home.header')
          }
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.contentContainer}
          contentContainerStyle={{
            paddingBottom: 10,
            paddingTop: 20,
          }}>
          {inputKeys}
        </ScrollView>
        {!currentFocused && (
          <CustomButton
            buttonStyles={styles.pasteButton}
            textContent={params ? t('constants.paste') : 'Scan QR'}
            actionFunction={
              params
                ? handleSeedFromClipboard
                : () =>
                    navigate.navigate('CameraModal', {
                      updateBitcoinAdressFunc: handleCameraScan,
                      fromPage: 'addContact',
                    })
            }
          />
        )}
        {!currentFocused && (
          <View
            style={{
              ...styles.mainBTCContainer,
              paddingBottom: bottomPadding,
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
                  ? navigate.navigate('PinSetup', {isInitialLoad: true})
                  : handleSeedFromClipboard()
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
              actionFunction={params ? didEnterCorrectSeed : keyValidation}
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
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyContainer: {
    flex: 1,
    width: WINDOWWIDTH,
    ...CENTER,
  },
  navContainer: {
    marginRight: 'auto',
  },
  headerText: {
    fontSize: SIZES.xLarge,
    textAlign: 'center',
    marginBottom: 10,
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
    minHeight: 55,
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
