import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_DERIVED_ACCOUNTS,
  SIZES,
} from '../../../../../constants';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import {
  COLORS,
  FONT,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  WINDOWWIDTH,
} from '../../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import SuggestedWordContainer from '../../../../login/suggestedWords';
import isValidMnemonic from '../../../../../functions/isValidMnemonic';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import customUUID from '../../../../../functions/customUUID';
import { handleRestoreFromText } from '../../../../../functions/seed';
import getClipboardText from '../../../../../functions/getClipboardText';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
const NUMARRAY = Array.from({ length: 12 }, (_, i) => i + 1);
const INITIAL_KEY_STATE = NUMARRAY.reduce((acc, num) => {
  acc[`key${num}`] = '';
  return acc;
}, {});

export default function CreateCustodyAccountPage(props) {
  const maxLength = 50;
  const accountType = props?.route?.params?.accountType || 'derived';
  const { masterInfoObject } = useGlobalContextProvider();
  const { createDerivedAccount, createImportedAccount, custodyAccountsList } =
    useActiveCustodyAccount();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { bottomPadding } = useGlobalInsets();

  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [accountInformation, setAccountInformation] = useState({
    name: '',
    mnemoinc: '',
    dateCreated: Date.now(),
    password: '',
    isPasswordEnabled: false,
    uuid: customUUID(),
    isActive: false,
  });
  const [currentFocused, setCurrentFocused] = useState(null);
  const [inputedKey, setInputedKey] = useState(INITIAL_KEY_STATE);

  const keyRefs = useRef({});

  const { backgroundOffset, textColor, textInputColor } = GetThemeColors();

  const isOverLimit = accountInformation.name.length >= maxLength;
  const characterCountColor = isOverLimit
    ? theme && darkModeType
      ? textColor
      : COLORS.cancelRed
    : textColor;

  const navigate = useNavigation();

  const enteredAllSeeds = Object.values(inputedKey).filter(item => item);
  const { t } = useTranslation();

  const handleInputElement = useCallback((text, keyNumber) => {
    const restoredSeed = handleRestoreFromText(text);

    if (restoredSeed.didWork && restoredSeed?.seed?.length === 12) {
      const splitSeed = restoredSeed.seed;
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
    setCurrentFocused(keyNumber); // Update the current focused key
    setIsKeyboardActive(true);
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

  const handleCreateAccount = async () => {
    try {
      if (!accountInformation.name) return;

      setIsCreatingAccount(true);

      // Creating new account
      if (accountType === 'derived') {
        const nextIndex = Number(
          masterInfoObject.nextAccountDerivationIndex || 0,
        );
        if (nextIndex >= MAX_DERIVED_ACCOUNTS) {
          throw new Error(
            `Maximum of ${MAX_DERIVED_ACCOUNTS} accounts reached. Please delete unused accounts.`,
          );
        }

        // Create derived account (no seed needed)
        const response = await createDerivedAccount(accountInformation.name);
        if (!response.didWork) {
          setIsCreatingAccount(false);
          navigate.navigate('ErrorScreen', {
            errorMessage: response.error,
          });
          return;
        }
      } else {
        // Create imported account (requires seed validation)
        if (enteredAllSeeds.length !== 12) {
          setIsCreatingAccount(false);
          return;
        }

        const isValidSeed = isValidMnemonic(enteredAllSeeds);
        if (!isValidSeed) {
          setIsCreatingAccount(false);
          navigate.navigate('ErrorScreen', {
            errorMessage: t('errormessages.invalidSeedError'),
          });
          return;
        }

        const seedString = enteredAllSeeds.join(' ');
        const alreadyUsedSeed = custodyAccountsList.find(
          account => account?.mnemoinc?.toLowerCase() === seedString,
        );

        if (alreadyUsedSeed) {
          setIsCreatingAccount(false);
          navigate.navigate('ErrorScreen', {
            errorMessage: t(
              'settings.accountComponents.createAccountPage.alreadyUsingSeedError',
            ),
          });
          return;
        }

        const response = await createImportedAccount(
          accountInformation.name,
          seedString,
        );
        if (!response.didWork) {
          setIsCreatingAccount(false);
          navigate.navigate('ErrorScreen', {
            errorMessage: response.error,
          });
          return;
        }
      }

      setIsCreatingAccount(false);
      navigate.popTo('SettingsContentHome', {
        for: 'Accounts',
      });
    } catch (err) {
      console.log('Create custody account error', err);
      setIsCreatingAccount(false);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    }
  };

  const seedItemBackgroundColor = useMemo(
    () => (theme ? backgroundOffset : COLORS.darkModeText),
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
          style={[styles.seedRow, { marginBottom: item2 !== 12 ? 10 : 0 }]}
        >
          {/* First item in row */}
          <View
            style={[
              styles.seedItem,
              { backgroundColor: seedItemBackgroundColor },
            ]}
          >
            <ThemeText styles={styles.numberText} content={`${item1}.`} />
            <TextInput
              autoCorrect={false}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              textContentType="none"
              keyboardAppearance={theme ? 'dark' : 'light'}
              ref={ref => (keyRefs.current[item1] = ref)}
              value={inputedKey[`key${item1}`]}
              onFocus={() => handleFocus(item1)}
              onSubmitEditing={() => handleSubmit(item1)}
              onChangeText={e => handleInputElement(e, item1)}
              // blurOnSubmit={false}
              submitBehavior="submit"
              cursorColor={COLORS.lightModeText}
              style={[styles.textInputStyle, { color: textColor }]}
            />
          </View>

          {/* Second item in row */}
          <View
            style={[
              styles.seedItem,
              { backgroundColor: seedItemBackgroundColor },
            ]}
          >
            <ThemeText styles={styles.numberText} content={`${item2}.`} />
            <TextInput
              autoCorrect={false}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              textContentType="none"
              keyboardAppearance={theme ? 'dark' : 'light'}
              ref={ref => (keyRefs.current[item2] = ref)}
              value={inputedKey[`key${item2}`]}
              onFocus={() => handleFocus(item2)}
              onSubmitEditing={() => handleSubmit(item2)}
              onChangeText={e => handleInputElement(e, item2)}
              submitBehavior="submit"
              cursorColor={COLORS.lightModeText}
              style={[styles.textInputStyle, { color: textColor }]}
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
        setIsKeyboardActive(false);
      },
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, []);

  const memorizedKeyboardStyle = useMemo(() => {
    return {
      alignItems: 'center',
      position: 'relative',
      paddingBottom: isKeyboardActive
        ? currentFocused
          ? 0
          : CONTENT_KEYBOARD_OFFSET
        : bottomPadding,
    };
  }, [isKeyboardActive, currentFocused, bottomPadding]);

  return (
    <CustomKeyboardAvoidingView
      globalThemeViewStyles={memorizedKeyboardStyle}
      isKeyboardActive={isKeyboardActive}
    >
      <View style={{ width: '95%' }}>
        <CustomSettingsTopBar
          shouldDismissKeyboard={true}
          label={t('settings.accountComponents.createAccountPage.createTitle')}
          iconNew="Trash2"
        />
      </View>
      <ScrollView
        style={{ width: INSET_WINDOW_WIDTH }}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 10 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={'handled'}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <ThemeText
            styles={{
              fontSize: SIZES.large,
              marginRight: 5,
            }}
            content={t(
              'settings.accountComponents.createAccountPage.inputDesc',
            )}
          />
        </View>
        <CustomSearchInput
          inputText={accountInformation.name}
          setInputText={e => {
            setAccountInformation(prev => {
              return { ...prev, name: e };
            });
          }}
          maxLength={maxLength}
          containerStyles={{
            borderRadius: 8,
          }}
          textInputStyles={{
            color: textInputColor,
          }}
          placeholderText={t(
            'settings.accountComponents.createAccountPage.nameInputPlaceholder',
          )}
          onFocusFunction={() => {
            setIsKeyboardActive(true);
            setCurrentFocused(null);
          }}
        />
        <ThemeText
          styles={{
            textAlign: 'right',
            color: characterCountColor,
            marginTop: 5,
          }}
          content={`${accountInformation.name.length} / ${maxLength}`}
        />

        {accountType === 'imported' && (
          <>
            <ThemeText
              styles={{
                fontSize: SIZES.large,

                marginBottom: 10,
                marginTop: 30,
              }}
              content={t(
                'settings.accountComponents.createAccountPage.seedHeader',
              )}
            />
            {inputKeys}

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                marginTop: 10,
                columnGap: 10,
                rowGap: 10,
              }}
            >
              <CustomButton
                buttonStyles={{
                  flex: 1,
                }}
                actionFunction={async () => {
                  const response = await getClipboardText();
                  if (!response.didWork) throw new Error(t(response.reason));

                  const data = response.data;

                  const restoredSeed = handleRestoreFromText(data);

                  const splitSeed = restoredSeed.seed;

                  if (!splitSeed.every(word => word.trim().length > 0)) {
                    navigate.navigate('ErrorScreen', {
                      errorMessage: t(
                        'errormessages.invalidSeedWordLengthErorr',
                      ),
                    });
                    return;
                  }

                  if (splitSeed.length != 12) {
                    navigate.navigate('ErrorScreen', {
                      errorMessage: t('errormessages.invalidSeedLengthError'),
                    });
                  }

                  const newKeys = {};
                  NUMARRAY.forEach((num, index) => {
                    newKeys[`key${num}`] = splitSeed[index];
                  });
                  setInputedKey(newKeys);
                }}
                textContent={t('constants.paste')}
              />
            </View>
          </>
        )}
      </ScrollView>
      {!isKeyboardActive && (
        <CustomButton
          useLoading={isCreatingAccount}
          loadingColor={COLORS.darkModeText}
          buttonStyles={{
            marginTop: 5,
            minWidth: 150,
            ...CENTER,
            opacity:
              !accountInformation.name ||
              (accountType !== 'derived' && enteredAllSeeds.length !== 12)
                ? HIDDEN_OPACITY
                : 1,
          }}
          textContent={t(
            'settings.accountComponents.createAccountPage.createTitle',
          )}
          actionFunction={handleCreateAccount}
        />
      )}

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
  innerContainer: {
    flex: 1,
    width: '95%',
    ...CENTER,
  },
  selectFromPhotos: {
    width: 30,
    height: 30,
    borderRadius: 20,
    backgroundColor: COLORS.darkModeText,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 12.5,
    bottom: 12.5,
    zIndex: 2,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 125,
    backgroundColor: 'red',
    ...CENTER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },

  textInput: {
    fontSize: SIZES.medium,
    padding: 10,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
    borderRadius: 8,
    marginBottom: 10,
  },
  textInputContainer: { width: '100%' },
  textInputContainerDescriptionText: {
    marginBottom: 5,
  },

  keyContainer: {
    flex: 1,
    width: WINDOWWIDTH,
    ...CENTER,
  },
  navContainer: {
    marginRight: 'auto',
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
  },

  mainBTCContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    ...CENTER,
  },
});
