import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  COLORS,
  FONT,
  SIZES,
  VALID_USERNAME_REGEX,
  VALID_NAME_BIO_REGEX,
} from '../../../../../constants';
import { CENTER } from '../../../../../constants';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import CustomButton from '../../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';
import { isValidUniqueName } from '../../../../../../db';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import { keyboardGoBack } from '../../../../../functions/customNavigation';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import { useTranslation } from 'react-i18next';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';

const FIELD_CONFIG = {
  name: {
    title: 'contacts.editMyProfilePage.nameInputDesc',
    description: 'contacts.editProfileFieldPage.nameDescription',
    maxLength: 30,
    multiline: false,
  },
  uniquename: {
    title: 'contacts.editMyProfilePage.uniqueNameInputDesc',
    description: 'contacts.editProfileFieldPage.uniquenameDescription',
    maxLength: 30,
    multiline: false,
  },
  bio: {
    title: 'contacts.editMyProfilePage.bioInputDesc',
    description: 'contacts.editProfileFieldPage.bioDescription',
    maxLength: 150,
    multiline: true,
  },
};

// username validation states
const USERNAME_STATE = {
  IDLE: 'idle',
  CHECKING: 'checking',
  AVAILABLE: 'available',
  TAKEN: 'taken',
  INVALID: 'invalid',
};

export default function EditProfileFieldPage(props) {
  const fieldKey = props.route?.params?.fieldKey;
  const config = FIELD_CONFIG[fieldKey] || FIELD_CONFIG.name;

  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textInputColor, textColor } = GetThemeColors();
  const { globalContactsInformation, toggleGlobalContactsInformation } =
    useGlobalContactsInfo();
  const { t } = useTranslation();

  const myContact = globalContactsInformation.myProfile;
  const hasEdited = myContact?.didEditProfile || false;

  const initialValue =
    fieldKey === 'name'
      ? myContact?.name || ''
      : fieldKey === 'uniquename'
      ? hasEdited
        ? myContact?.uniqueName || ''
        : ''
      : myContact?.bio || '';

  const [value, setValue] = useState(initialValue);
  const [usernameState, setUsernameState] = useState(USERNAME_STATE.IDLE);
  const [isSaving, setIsSaving] = useState(false);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const debounceRef = useRef(null);
  const isMountedRef = useRef(true);
  const inputRef = useRef(null);
  const isGoingBackRef = useRef(false);

  const isValidContent =
    fieldKey === 'uniquename' || VALID_NAME_BIO_REGEX.test(value);
  const didEdit = initialValue !== value;

  const handleHardwareBack = useCallback(() => {
    if (isGoingBackRef.current) return true; // race guard

    // Unsaved edits + keyboard open: keep current behavior — just close the keyboard.
    if (didEdit && isKeyboardActive) {
      setIsKeyboardActive(false);
      return true;
    }

    // No edits (or keyboard already closed): close keyboard + navigate in one press.
    isGoingBackRef.current = true;
    keyboardGoBack(navigate);
    setIsKeyboardActive(false);
    return true;
  }, [didEdit, isKeyboardActive, navigate]);

  useHandleBackPressNew(handleHardwareBack);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (fieldKey !== 'uniquename') return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();

    if (!trimmed) {
      setUsernameState(USERNAME_STATE.IDLE);
      return;
    }

    if (!VALID_USERNAME_REGEX.test(trimmed)) {
      setUsernameState(USERNAME_STATE.INVALID);
      return;
    }

    if (trimmed.toLowerCase() === myContact?.uniqueName?.toLowerCase()) {
      setUsernameState(USERNAME_STATE.AVAILABLE);
      return;
    }

    setUsernameState(USERNAME_STATE.CHECKING);
    debounceRef.current = setTimeout(async () => {
      try {
        const isFree = await isValidUniqueName('blitzWalletUsers', trimmed);
        if (isMountedRef.current) {
          setUsernameState(
            isFree ? USERNAME_STATE.AVAILABLE : USERNAME_STATE.TAKEN,
          );
        }
      } catch {
        if (isMountedRef.current) setUsernameState(USERNAME_STATE.IDLE);
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fieldKey]);

  const canSave =
    !isSaving &&
    isValidContent &&
    (fieldKey !== 'uniquename' || usernameState === USERNAME_STATE.AVAILABLE);

  async function handleSave() {
    if (isGoingBackRef.current) return;

    if (!canSave) {
      isGoingBackRef.current = true;
      keyboardGoBack(navigate);
      return;
    }

    const trimmed = value.trim();

    const noChange =
      fieldKey === 'name'
        ? trimmed === myContact?.name
        : fieldKey === 'uniquename'
        ? trimmed === myContact?.uniqueName
        : trimmed === myContact?.bio;

    if (noChange) {
      isGoingBackRef.current = true;
      keyboardGoBack(navigate);
      return;
    }

    setIsSaving(true);
    try {
      let profileUpdate = { ...myContact, didEditProfile: true };

      if (fieldKey === 'name') {
        profileUpdate.name = trimmed;
        profileUpdate.nameLower = trimmed.toLowerCase();
      } else if (fieldKey === 'uniquename') {
        profileUpdate.uniqueName = trimmed;
        profileUpdate.uniqueNameLower = trimmed.toLowerCase();
      } else {
        profileUpdate.bio = trimmed;
      }

      toggleGlobalContactsInformation(
        {
          myProfile: profileUpdate,
          addedContacts: globalContactsInformation.addedContacts,
        },
        true,
      );
      isGoingBackRef.current = true;
      await keyboardGoBack(navigate);
    } catch (err) {
      console.log(err);
    } finally {
      setIsSaving(false);
    }
  }

  const labelMap = {
    name: t('contacts.editMyProfilePage.nameInputDesc'),
    uniquename: t('contacts.editMyProfilePage.uniqueNameInputDesc'),
    bio: t('contacts.editMyProfilePage.bioInputDesc'),
  };
  const fieldLabel = labelMap[fieldKey] || '';

  const statusText =
    fieldKey === 'uniquename'
      ? usernameState === USERNAME_STATE.TAKEN
        ? t('contacts.editMyProfilePage.usernameAlreadyExistsError')
        : usernameState === USERNAME_STATE.INVALID
        ? t('contacts.editMyProfilePage.unqiueNameRegexError')
        : `${value.length} / ${config.maxLength}`
      : !isValidContent
      ? t('contacts.editMyProfilePage.invalidCharactersError')
      : `${value.length} / ${config.maxLength}`;

  const statusColor =
    fieldKey === 'uniquename'
      ? usernameState === USERNAME_STATE.AVAILABLE ||
        usernameState === USERNAME_STATE.CHECKING ||
        usernameState === USERNAME_STATE.IDLE
        ? textColor
        : theme && darkModeType
        ? textColor
        : COLORS.cancelRed
      : !isValidContent
      ? theme && darkModeType
        ? textColor
        : COLORS.cancelRed
      : textColor;

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}
      useLocalPadding={true}
      isKeyboardActive={isKeyboardActive}
    >
      <CustomSettingsTopBar
        customBackFunction={() => {
          if (isGoingBackRef.current) return;
          isGoingBackRef.current = true;
          keyboardGoBack(navigate);
        }}
      />

      <View style={styles.content}>
        <View style={styles.topSection}>
          <ThemeText styles={styles.title} content={t(config.title)} />

          {config.description && (
            <ThemeText
              styles={styles.description}
              content={t(config.description)}
            />
          )}

          <ThemeText styles={styles.inputLabel} content={fieldLabel} />

          <View style={styles.inputCard}>
            <CustomSearchInput
              textInputRef={inputRef}
              inputText={value}
              setInputText={setValue}
              maxLength={config.maxLength}
              textInputMultiline={config.multiline}
              textAlignVertical={config.multiline ? 'top' : 'center'}
              onBlurFunction={handleHardwareBack}
              onFocusFunction={() => setIsKeyboardActive(true)}
              textInputStyles={{ paddingRight: 20 }}
              placeholderText={
                fieldKey === 'uniquename' && !hasEdited
                  ? myContact?.uniqueName || ''
                  : undefined
              }
            />
            {fieldKey === 'uniquename' && (
              <View style={styles.usernameIcon}>
                {usernameState === USERNAME_STATE.CHECKING ? (
                  <ActivityIndicator size="small" color={textInputColor} />
                ) : usernameState === USERNAME_STATE.AVAILABLE ? (
                  <ThemeIcon
                    iconName="CircleCheck"
                    size={20}
                    colorOverride={
                      theme && darkModeType ? textInputColor : COLORS.nostrGreen
                    }
                  />
                ) : usernameState === USERNAME_STATE.INVALID ||
                  usernameState === USERNAME_STATE.TAKEN ? (
                  <ThemeIcon
                    iconName="CircleAlert"
                    size={20}
                    colorOverride={
                      theme && darkModeType ? textInputColor : COLORS.cancelRed
                    }
                  />
                ) : null}
              </View>
            )}
          </View>

          {statusText && (
            <ThemeText
              styles={[
                styles.statusText,
                {
                  color: statusColor,
                  opacity:
                    usernameState === USERNAME_STATE.TAKEN ||
                    usernameState === USERNAME_STATE.INVALID ||
                    !isValidContent
                      ? 1
                      : 0.55,
                },
              ]}
              content={statusText}
            />
          )}
        </View>

        <CustomButton
          buttonStyles={{
            width: '100%',
            ...CENTER,
          }}
          actionFunction={handleSave}
          useLoading={isSaving}
          textContent={
            didEdit && canSave ? t('constants.save') : t('constants.back')
          }
        />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    width: INSET_WINDOW_WIDTH,
    flex: 1,
    justifyContent: 'space-between',
    ...CENTER,
  },
  topSection: {
    flex: 1,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 10,
    marginBottom: 8,
  },
  description: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
    opacity: 0.6,
    lineHeight: 22,
    marginBottom: 16,
  },
  inputCard: {
    borderRadius: 12,
    marginTop: 8,
    justifyContent: 'center',
  },
  inputLabel: {
    width: '100%',
    fontSize: SIZES.small,
    includeFontPadding: false,
    opacity: 0.55,
    marginBottom: 4,
    textTransform: 'uppercase',
    marginTop: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
    padding: 0,
  },
  multilineInput: {
    minHeight: 60,
    maxHeight: 120,
  },
  usernameIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
  },
  statusText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    marginTop: 8,
  },
});
