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
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
} from '../../../../../constants';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import { createAccountMnemonic } from '../../../../../functions';
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
import useCustodyAccountList from '../../../../../hooks/useCustodyAccountsList';
import { handleRestoreFromText } from '../../../../../functions/seed';
import getClipboardText from '../../../../../functions/getClipboardText';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
const NUMARRAY = Array.from({ length: 12 }, (_, i) => i + 1);
const INITIAL_KEY_STATE = NUMARRAY.reduce((acc, num) => {
  acc[`key${num}`] = '';
  return acc;
}, {});

export default function CreateCustodyAccountPage(props) {
  const selectedAccount = props?.route?.params?.account;
  const { createAccount, currentWalletMnemoinc, removeAccount, updateAccount } =
    useActiveCustodyAccount();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { bottomPadding } = useGlobalInsets();

  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [accountInformation, setAccountInformation] = useState({
    name: selectedAccount?.name || '',
    mnemoinc: selectedAccount?.mnemoinc || '',
    dateCreated: selectedAccount?.dateCreated || Date.now(),
    password: selectedAccount?.password || '',
    isPasswordEnabled: selectedAccount?.isPasswordEnabled || false,
    uuid: selectedAccount?.uuid || customUUID(),
    isActive: selectedAccount?.isActive || false,
  });
  const [currentFocused, setCurrentFocused] = useState(null);
  const [inputedKey, setInputedKey] = useState(INITIAL_KEY_STATE);

  const keyRefs = useRef({});
  const blockDeleteAccountRef = useRef(null);

  const { backgroundOffset, textColor, textInputColor } = GetThemeColors();

  const accounts = useCustodyAccountList();
  const navigate = useNavigation();

  const foundAccount = accounts.find(
    account =>
      account.name.toLowerCase() === accountInformation.name.toLowerCase(),
  );
  const deleatedAccount = !!accounts.find(
    account =>
      account.name.toLowerCase() === selectedAccount?.name.toLowerCase(),
  );
  const nameIsAlreadyUsed =
    Boolean(foundAccount) && foundAccount?.name !== selectedAccount?.name;

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

  useEffect(() => {
    async function initalizeAccount() {
      const mnemoinc = await (selectedAccount
        ? Promise.resolve(selectedAccount.mnemoinc)
        : createAccountMnemonic(true));
      const mnemoincArray = mnemoinc.split(' ');
      const keyState = NUMARRAY.reduce((acc, num) => {
        acc[`key${num}`] = mnemoincArray[num - 1];
        return acc;
      }, {});
      setInputedKey(keyState);
      setAccountInformation(prev => ({
        ...prev,
        mnemoinc,
      }));
    }
    initalizeAccount();
  }, []);

  useEffect(() => {
    if (!blockDeleteAccountRef.current) {
      blockDeleteAccountRef.current = true;
      return;
    }

    if (deleatedAccount) return;
    navigate.goBack();
  }, [deleatedAccount]);

  const regenerateSeed = async () => {
    const mnemoinc = await createAccountMnemonic(true);
    const mnemoincArray = mnemoinc.split(' ');
    const keyState = NUMARRAY.reduce((acc, num) => {
      acc[`key${num}`] = mnemoincArray[num - 1];
      return acc;
    }, {});
    setInputedKey(keyState);
    setAccountInformation(prev => ({
      ...prev,
      mnemoinc,
    }));
  };

  const handleCreateAccount = async () => {
    try {
      if (!accountInformation.name) return;
      if (nameIsAlreadyUsed) return;
      if (enteredAllSeeds.length !== 12) return;
      if (
        selectedAccount?.name?.toLowerCase() ===
        accountInformation.name.toLowerCase()
      ) {
        navigate.goBack();
        return;
      }
      const isValidSeed = isValidMnemonic(enteredAllSeeds);
      if (!isValidSeed) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('errormessages.invalidSeedError'),
        });
        return;
      }
      const seedString = enteredAllSeeds.join(' ');
      const alreadyUsedSeed = selectedAccount
        ? false
        : accounts.find(
            account => account.mnemoinc.toLowerCase() === seedString,
          );
      if (alreadyUsedSeed) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t(
            'settings.accountComponents.createAccountPage.alreadyUsingSeedError',
          ),
        });
        return;
      }
      setIsCreatingAccount(true);

      if (selectedAccount) {
        const response = await updateAccount(accountInformation);
        if (!response.didWork) throw new Error(response.err);
      } else {
        const response = await createAccount({
          ...accountInformation,
          mnemoinc: seedString,
        });
        if (!response.didWork) throw new Error(response.err);
      }
      setIsCreatingAccount(false);
      navigate.goBack();
    } catch (err) {
      console.log('Create custody account error', err);
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

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      globalThemeViewStyles={{
        alignItems: 'center',
        position: 'relative',
        paddingBottom: isKeyboardActive
          ? currentFocused
            ? 0
            : CONTENT_KEYBOARD_OFFSET
          : bottomPadding,
      }}
      isKeyboardActive={isKeyboardActive}
    >
      <View style={{ width: '95%' }}>
        <CustomSettingsTopBar
          shouldDismissKeyboard={true}
          label={
            selectedAccount
              ? t('settings.accountComponents.createAccountPage.editTitle')
              : t('settings.accountComponents.createAccountPage.createTitle')
          }
          iconNew="Trash2"
          showLeftImage={selectedAccount}
          leftImageFunction={() => {
            if (currentWalletMnemoinc === selectedAccount?.mnemoinc) {
              navigate.navigate('ErrorScreen', {
                errorMessage: t(
                  'settings.accountComponents.createAccountPage.cannotDeleteActiveAccountError',
                ),
              });
              return;
            }
            navigate.navigate('ConfirmActionPage', {
              confirmMessage: t(
                'settings.accountComponents.createAccountPage.deleteAccountConfirmation',
              ),
              confirmFunction: () => removeAccount(selectedAccount),
              cancelFunction: () => {},
            });
          }}
        />
      </View>
      <ScrollView
        style={{ width: INSET_WINDOW_WIDTH }}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 10 }}
        showsVerticalScrollIndicator={false}
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
          {nameIsAlreadyUsed && (
            <TouchableOpacity
              onPress={() => {
                navigate.navigate('InformationPopup', {
                  textContent: t(
                    'settings.accountComponents.createAccountPage.nameTakenError',
                  ),
                  buttonText: t('constants.understandText'),
                });
              }}
            >
              <ThemeIcon
                size={20}
                colorOverride={
                  theme && darkModeType ? COLORS.darkModeText : COLORS.cancelRed
                }
                iconName={'CircleAlert'}
              />
            </TouchableOpacity>
          )}
        </View>
        <CustomSearchInput
          inputText={accountInformation.name}
          setInputText={e => {
            setAccountInformation(prev => {
              return { ...prev, name: e };
            });
          }}
          containerStyles={{
            borderColor: nameIsAlreadyUsed
              ? theme && darkModeType
                ? COLORS.darkModeText
                : COLORS.cancelRed
              : 'transparent',
            borderWidth: 1,
            borderRadius: 8,
          }}
          textInputStyles={{
            color:
              nameIsAlreadyUsed && !(theme && darkModeType)
                ? COLORS.cancelRed
                : textInputColor,
          }}
          placeholderText={t(
            'settings.accountComponents.createAccountPage.nameInputPlaceholder',
          )}
          onFocusFunction={() => {
            setIsKeyboardActive(true);
            setCurrentFocused(null);
          }}
        />

        {!selectedAccount && (
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
                  minWidth: 150,
                  backgroundColor: theme ? backgroundOffset : COLORS.primary,
                }}
                textStyles={{ color: COLORS.darkModeText }}
                actionFunction={regenerateSeed}
                textContent={t('constants.regenerate')}
              />
              <CustomButton
                actionFunction={() => setInputedKey(INITIAL_KEY_STATE)}
                buttonStyles={{
                  flex: 1,
                  minWidth: 150,
                  backgroundColor: theme ? backgroundOffset : COLORS.primary,
                }}
                textStyles={{ color: COLORS.darkModeText }}
                textContent={t('constants.restore')}
              />
            </View>
            {inputedKey === INITIAL_KEY_STATE && (
              <CustomButton
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
                buttonStyles={{
                  marginTop: 10,
                }}
                textContent={t('constants.paste')}
              />
            )}
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
              nameIsAlreadyUsed ||
              enteredAllSeeds.length !== 12 ||
              selectedAccount?.name?.toLowerCase() ===
                accountInformation?.name?.toLowerCase()
                ? HIDDEN_OPACITY
                : 1,
          }}
          textContent={
            selectedAccount
              ? t('settings.accountComponents.createAccountPage.updateTitle')
              : t('settings.accountComponents.createAccountPage.createTitle')
          }
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
