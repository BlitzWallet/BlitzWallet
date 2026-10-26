import { View, TextInput, StyleSheet, useWindowDimensions } from 'react-native';
import CustomScrollView from '../../../functions/CustomElements/scrollView';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import isValidMnemonic from '../../../functions/isValidMnemonic';
import sha256Hash from '../../../functions/hash';
import { useTranslation } from 'react-i18next';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../functions/CustomElements';
import SuggestedWordContainer from '../../../components/login/suggestedWords';
import CustomButton from '../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../functions/CustomElements/loadingScreen';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import { useNavigation } from '@react-navigation/native';
import { crashlyticsLogReport } from '../../../functions/crashlyticsLogs';
import { useKeysContext } from '../../../../context-store/keys';
import { handleRestoreFromText } from '../../../functions/seed';
import parseStandardSeedQR from '../../../functions/parseStandardSeedQR';
import { useGlobalInsets } from '../../../../context-store/insetsProvider';
import TopBar from '../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../functions/CustomElements/redesign/PageHeader';
import {
  KeyboardController,
  KeyboardEvents,
} from 'react-native-keyboard-controller';

const NUMARRAY = Array.from({ length: 12 }, (_, i) => i + 1);
const INITIAL_KEY_STATE = NUMARRAY.reduce((acc, num) => {
  acc[`key${num}`] = '';
  return acc;
}, {});

export default function RestoreWallet({ navigation: { reset } }) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { setAccountMnemonic } = useKeysContext();
  const { theme, darkModeType, tokens } = useGlobalThemeContext();
  const { bottomPadding } = useGlobalInsets();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const [isValidating, setIsValidating] = useState(false);
  const [currentFocused, setCurrentFocused] = useState(null);
  const keyRefs = useRef({});
  const blurTimeoutRef = useRef(null);
  const [inputedKey, setInputedKey] = useState(INITIAL_KEY_STATE);

  // Helper functions
  const navigateToError = useCallback(
    errorMessage => {
      navigate.navigate('ErrorScreen', { errorMessage });
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

    setInputedKey(prev => ({ ...prev, [`key${keyNumber}`]: text }));
  }, []);

  const handleFocus = useCallback(keyNumber => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setCurrentFocused(keyNumber);
  }, []);

  const handleBlur = useCallback(() => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = setTimeout(() => {
      blurTimeoutRef.current = null;
      setCurrentFocused(null);
    }, 150);
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
        const restoredSeed = mnemonic.join(' ');
        setAccountMnemonic(restoredSeed);
        // Thread the hash of the seed the user actually entered through to the
        // loading screen (via PinSetup). This is the source of truth for the
        // account identity — immune to any later clobber of the shared
        // accountMnemoinc context.
        navigate.navigate('PinSetup', {
          didRestoreWallet: true,
          expectedMnemonicHash: sha256Hash(restoredSeed),
        });
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
      const seedMnemoinc = parseStandardSeedQR(data);
      if (!seedMnemoinc) {
        if (localTry) return false;
        throw new Error(
          t('createAccount.restoreWallet.home.noSeedInNumberArray'),
        );
      }
      const newKeys = {};
      NUMARRAY.forEach((num, index) => {
        newKeys[`key${num}`] = seedMnemoinc[index];
      });
      setInputedKey(newKeys);
      return seedMnemoinc;
    } catch (err) {
      console.log('error getting seed from camera', err);
      if (localTry) return false;
      navigate.navigate('ErrorScreen', {
        errorMessage: t('createAccount.restoreWallet.home.noSeedInQr'),
      });
    }
  };

  const seedItemBackgroundColor = useMemo(() => tokens.surface, [tokens]);

  const inputKeys = useMemo(() => {
    const rows = [];

    // Process input fields in pairs
    for (let i = 0; i < NUMARRAY.length; i += 2) {
      const item1 = NUMARRAY[i];
      const item2 = NUMARRAY[i + 1];

      rows.push(
        <View
          key={`row${item1}`}
          style={[styles.seedRow, { marginBottom: item2 !== 12 ? 10 : 0 }]}
        >
          {/* First item in row */}
          <View
            style={[
              styles.seedItem,
              {
                backgroundColor: seedItemBackgroundColor,
                borderColor:
                  currentFocused === item1 ? tokens.accent : 'transparent',
              },
            ]}
          >
            <ThemeText
              styles={[styles.numberText, { color: tokens.muted }]}
              content={`${item1}.`}
            />
            <TextInput
              autoCorrect={false}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              textContentType="none"
              importantForAutofill="no"
              keyboardType="visible-password"
              disableFullscreenUI={true}
              keyboardAppearance={theme ? 'dark' : 'light'}
              ref={ref => (keyRefs.current[item1] = ref)}
              value={inputedKey[`key${item1}`]}
              onFocus={() => handleFocus(item1)}
              onBlur={handleBlur}
              onSubmitEditing={() => handleSubmit(item1)}
              onChangeText={e => handleInputElement(e, item1)}
              blurOnSubmit={false}
              cursorColor={tokens.ink}
              style={[styles.textInputStyle, { color: tokens.ink }]}
            />
          </View>

          {/* Second item in row */}
          <View
            style={[
              styles.seedItem,
              {
                backgroundColor: seedItemBackgroundColor,
                borderColor:
                  currentFocused === item2 ? tokens.accent : 'transparent',
              },
            ]}
          >
            <ThemeText
              styles={[styles.numberText, { color: tokens.muted }]}
              content={`${item2}.`}
            />
            <TextInput
              autoCorrect={false}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              textContentType="none"
              importantForAutofill="no"
              keyboardType="visible-password"
              disableFullscreenUI={true}
              keyboardAppearance={theme ? 'dark' : 'light'}
              ref={ref => (keyRefs.current[item2] = ref)}
              value={inputedKey[`key${item2}`]}
              onFocus={() => handleFocus(item2)}
              onBlur={handleBlur}
              onSubmitEditing={() => handleSubmit(item2)}
              onChangeText={e => handleInputElement(e, item2)}
              blurOnSubmit={false}
              cursorColor={tokens.ink}
              style={[styles.textInputStyle, { color: tokens.ink }]}
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
    currentFocused,
    tokens,
  ]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const keyboardDidHideListener = KeyboardEvents.addListener(
      'keyboardDidHide',
      () => {
        setCurrentFocused(null);
        if (keyRefs.current[currentFocused]?.isFocused()) {
          keyRefs.current[currentFocused]?.blur();
        }
      },
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, [currentFocused]);

  if (isValidating) {
    return <FullLoadingScreen text={t('constants.validating')} />;
  }

  return (
    <CustomKeyboardAvoidingView
      touchableWithoutFeedbackFunction={KeyboardController.dismiss}
      useLocalPadding={false}
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
    >
      <View style={[styles.viewContainer, { width: contentWidth }]}>
        <TopBar />
        <View style={styles.keyContainer}>
          <CustomScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentContainer}
          >
            <PageHeader
              large
              title={t('createAccount.restoreWallet.home.header')}
              sub={t('createAccount.restoreWallet.home.desc')}
            />
            <View style={styles.seedGrid}>{inputKeys}</View>
          </CustomScrollView>

          {!currentFocused && (
            <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
              <CustomButton
                size="regular"
                tone="secondary"
                icon="ScanLine"
                textContent={t('createAccount.restoreWallet.home.scanQr')}
                actionFunction={() =>
                  navigate.navigate('CameraModal', {
                    updateBitcoinAdressFunc: handleCameraScan,
                    fromPage: 'addContact',
                  })
                }
              />
              <CustomButton
                size="regular"
                textContent={t('constants.restore')}
                actionFunction={keyValidation}
              />
            </View>
          )}
        </View>
      </View>

      {currentFocused && (
        <View style={styles.suggestionBreakout}>
          <SuggestedWordContainer
            inputedKey={inputedKey}
            setInputedKey={setInputedKey}
            selectedKey={currentFocused}
            keyRefs={keyRefs}
          />
        </View>
      )}
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  viewContainer: {
    flex: 1,
    ...CENTER,
  },
  keyContainer: {
    flex: 1,
    width: '100%',
    ...CENTER,
  },
  suggestionBreakout: {
    // Parent is the 95% standard-width container, but the suggestion strip
    // must stay full screen width on native: 100/95 ≈ 105.263% wide,
    // shifted left by 2.5/95 ≈ 2.632% to bleed symmetrically.
    width: '105.263%',
    marginLeft: '-2.632%',
  },
  navContainer: {
    marginRight: 'auto',
  },
  contentContainer: {
    flexGrow: 1,
    width: '100%',
    ...CENTER,
    paddingBottom: 20,
  },
  seedGrid: { marginTop: 28 },
  footer: {
    width: '100%',
    gap: 12,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
  pasteButton: {
    // width: 145,
    backgroundColor: 'transparent',
    borderWidth: 1,
    marginTop: 20,
    marginBottom: 20,
    ...CENTER,
    textAlign: 'center',
  },
  seedRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  // White r14 cells; the 2 pt border is the focus ring (transparent at rest).
  seedItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
  },
  numberText: {
    width: 22,
    fontSize: 13,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  textInputStyle: {
    flex: 1,
    minWidth: 0,
    height: 44,
    padding: 0,
    fontSize: 15,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
  },
});
