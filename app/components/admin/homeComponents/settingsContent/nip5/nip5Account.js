import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { CENTER, NOSTR_NAME_REGEX } from '../../../../../constants';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {
  COLORS,
  FONT,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import {
  addNip5toCollection,
  deleteNip5FromCollection,
  isValidNip5Name,
} from '../../../../../../db';
import { npubToHex } from '../../../../../functions/nostr';
import { copyToClipboard } from '../../../../../functions';
import { useToast } from '../../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import { keyboardGoBack } from '../../../../../functions/customNavigation';
import getClipboardText from '../../../../../functions/getClipboardText';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../../hooks/themeColors';
import { nip19 } from 'nostr-tools';

const NIP5_DOMAIN = '@blitzwalletapp.com';
const MAX_NAME_LENGTH = 60;

export default function Nip5VerificationPage() {
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, textInputColor, textInputBackground, backgroundColor } =
    GetThemeColors();
  const pubkeyInputRef = useRef(null);
  const { t } = useTranslation();
  const { name, pubkey } = masterInfoObject?.nip5Settings;

  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  // '' | 'checking' | 'available' | 'taken' | 'invalid'
  const [nameStatus, setNameStatus] = useState('');
  const [inputs, setInputs] = useState({
    name: name || '',
    // Saved as hex; shown as npub to match what users paste.
    pubkey: pubkey ? nip19.npubEncode(pubkey) : '',
  });

  const parsedName = inputs.name.trim();
  const parsedPubkey = useMemo(() => npubToHex(inputs.pubkey), [inputs.pubkey]);
  const isOwnName = !!name && parsedName.toLowerCase() === name.toLowerCase();
  const isSaved =
    !!name && !!pubkey && parsedName === name && parsedPubkey.data === pubkey;
  const canSave = nameStatus === 'available' && parsedPubkey.didWork;
  const isEditing = !isSaved && !!(parsedName || inputs.pubkey.trim());

  useEffect(() => {
    if (!parsedName) return setNameStatus('');
    if (!NOSTR_NAME_REGEX.test(parsedName)) return setNameStatus('invalid');
    if (isOwnName) return setNameStatus('available');

    setNameStatus('checking');
    let cancelled = false;
    const timer = setTimeout(async () => {
      const isNameFree = await isValidNip5Name(parsedName);
      if (!cancelled) setNameStatus(isNameFree ? 'available' : 'taken');
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [parsedName, isOwnName]);

  const handleInputText = (value, identifier) => {
    setInputs(prev => ({
      ...prev,
      [identifier]: value,
    }));
  };

  // Show any accepted format (hex, nprofile, nostr: URI) as a plain npub.
  const formatPubkey = value => {
    const parsed = npubToHex(value);
    return parsed.didWork ? nip19.npubEncode(parsed.data) : value;
  };

  // Blur is delayed, so only clear focus if it still belongs to this input.
  const focusHandlers = identifier => ({
    onFocusFunction: () => setFocusedInput(identifier),
    onBlurFunction: () => {
      setFocusedInput(prev => (prev === identifier ? null : prev));
      if (identifier === 'pubkey')
        setInputs(prev => ({ ...prev, pubkey: formatPubkey(prev.pubkey) }));
    },
  });

  const handlePaste = useCallback(async () => {
    const response = await getClipboardText();
    if (!response.didWork) {
      navigate.navigate('ErrorScreen', { errorMessage: t(response.reason) });
      return;
    }
    handleInputText(formatPubkey(response.data), 'pubkey');
  }, [navigate, t]);

  const openInfo = useCallback(() => {
    navigate.navigate('InformationPopup', {
      textContent: t('settings.nip5.infoText'),
      buttonText: t('constants.understandText'),
    });
  }, [navigate, t]);

  const saveNip5Information = async () => {
    try {
      setIsLoading(true);

      if (!isEditing) {
        keyboardGoBack(navigate);
        return;
      }
      if (!parsedName) throw new Error(t('settings.nip5.noNameError'));
      if (!inputs.pubkey) throw new Error(t('settings.nip5.noPubKey'));
      if (parsedName.length > MAX_NAME_LENGTH)
        throw new Error(t('settings.nip5.nameLengthError'));
      if (!NOSTR_NAME_REGEX.test(parsedName))
        throw new Error(t('settings.nip5.regexError'));
      if (!parsedPubkey.didWork) throw new Error(t(parsedPubkey.error));

      // Our own saved name reads as taken, so only re-check new names.
      if (!isOwnName) {
        const isNameFree = await isValidNip5Name(parsedName);
        if (!isNameFree) throw new Error(t('settings.nip5.takenNameError'));
      }

      await addNip5toCollection(
        {
          name: parsedName,
          nameLower: parsedName.toLowerCase(),
          pubkey: parsedPubkey.data,
          didUpdate: true,
        },
        masterInfoObject.uuid,
      );
      toggleMasterInfoObject({
        nip5Settings: {
          name: parsedName,
          pubkey: parsedPubkey.data,
        },
      });
      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.nip5.nameConfirmationMessage'),
      });
    } catch (err) {
      console.log('Error saving nip5 information', err);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const removeNip5Information = () => {
    navigate.navigate('ConfirmActionPage', {
      confirmMessage: t('settings.nip5.removeWarning', {
        address: `${name}${NIP5_DOMAIN}`,
      }),
      confirmFunction: async () => {
        setIsLoading(true);
        const didDelete = await deleteNip5FromCollection(masterInfoObject.uuid);
        setIsLoading(false);
        if (!didDelete) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('settings.nip5.dataIsInvalid'),
          });
          return;
        }
        toggleMasterInfoObject({ nip5Settings: { name: '', pubkey: '' } });
        setInputs({ name: '', pubkey: '' });
      },
    });
  };

  const errorColor = theme && darkModeType ? textColor : COLORS.cancelRed;
  const accentColor = theme && darkModeType ? textColor : COLORS.primary;

  const nameStatusText = {
    taken: { text: t('settings.nip5.takenNameError'), color: errorColor },
    invalid: { text: t('settings.nip5.regexError'), color: errorColor },
  }[nameStatus];

  const showPubkeyError = !!inputs.pubkey.trim() && !parsedPubkey.didWork;
  const isButtonDisabled = isEditing && !canSave;

  return (
    <CustomKeyboardAvoidingView
      globalThemeViewStyles={styles.globalContainer}
      isKeyboardActive={!!focusedInput}
      useLocalPadding={true}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={t('settings.nip5.title')}
        showLeftImage={true}
        iconNew="Info"
        leftImageStyles={{ height: 25 }}
        leftImageFunction={openInfo}
      />
      <CustomScrollView
        style={{ width: INSET_WINDOW_WIDTH }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={'handled'}
      >
        <TouchableOpacity
          activeOpacity={isSaved ? 0.2 : 1}
          onPress={() => {
            if (!isSaved) return;
            copyToClipboard(`${name}${NIP5_DOMAIN}`, showToast);
          }}
        >
          <ThemeText
            CustomNumberOfLines={1}
            styles={[styles.addressName, !parsedName && styles.placeholder]}
            content={parsedName || t('settings.nip5.usernameInputPlaceholder')}
          />
          <ThemeText styles={styles.addressDomain} content={NIP5_DOMAIN} />
        </TouchableOpacity>
        <View
          style={[styles.inputCard, { backgroundColor: textInputBackground }]}
        >
          <ThemeText
            styles={[styles.inputDescriptor, { color: textInputColor }]}
            content={t('settings.nip5.usernameInputLabel')}
          />
          <CustomSearchInput
            inputText={inputs.name}
            setInputText={e => handleInputText(e, 'name')}
            placeholderText={t('settings.nip5.usernameInputPlaceholder')}
            maxLength={MAX_NAME_LENGTH}
            containerStyles={styles.inputContainer}
            textInputStyles={styles.textInput}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditingFunction={() => pubkeyInputRef.current?.focus()}
            {...focusHandlers('name')}
            buttonComponent={
              <>
                {nameStatus === 'checking' ? (
                  <ActivityIndicator
                    style={styles.statusIcon}
                    size="small"
                    color={textInputColor}
                  />
                ) : nameStatus === 'available' ? (
                  <View style={styles.statusIcon}>
                    <ThemeIcon
                      iconName="CircleCheck"
                      size={20}
                      colorOverride={
                        theme && darkModeType
                          ? textInputColor
                          : COLORS.nostrGreen
                      }
                    />
                  </View>
                ) : nameStatus === 'taken' || nameStatus === 'invalid' ? (
                  <View style={styles.statusIcon}>
                    <ThemeIcon
                      iconName="CircleAlert"
                      size={20}
                      colorOverride={
                        theme && darkModeType
                          ? textInputColor
                          : COLORS.cancelRed
                      }
                    />
                  </View>
                ) : null}
              </>
            }
          />
          <View style={[styles.divider, { backgroundColor }]} />
          <ThemeText
            styles={[styles.inputDescriptor, { color: textInputColor }]}
            content={t('settings.nip5.publicKeyLabel')}
          />
          <CustomSearchInput
            textInputRef={pubkeyInputRef}
            inputText={inputs.pubkey}
            setInputText={e => handleInputText(e, 'pubkey')}
            placeholderText={t('settings.nip5.publicKeyPlaceholder')}
            containerStyles={styles.inputContainer}
            textInputStyles={styles.textInput}
            returnKeyType="done"
            {...focusHandlers('pubkey')}
            buttonComponent={
              <TouchableOpacity
                onPress={handlePaste}
                style={[
                  styles.pasteButton,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? COLORS.lightsOutBackground
                        : COLORS.primary + '22',
                  },
                ]}
              >
                <ThemeText
                  styles={[styles.pasteText, { color: accentColor }]}
                  content={t('constants.paste')}
                />
              </TouchableOpacity>
            }
          />
        </View>
        {!!nameStatusText && (
          <ThemeText
            styles={[styles.statusText, { color: nameStatusText.color }]}
            content={nameStatusText.text}
          />
        )}
        {showPubkeyError && (
          <ThemeText
            styles={[styles.statusText, { color: errorColor }]}
            content={t(parsedPubkey.error)}
          />
        )}
      </CustomScrollView>
      {!focusedInput && (
        <>
          <CustomButton
            useLoading={isLoading}
            disabled={isButtonDisabled}
            actionFunction={saveNip5Information}
            buttonStyles={{
              ...CENTER,
              width: INSET_WINDOW_WIDTH,
              opacity: isButtonDisabled ? HIDDEN_OPACITY : 1,
            }}
            textContent={
              isEditing ? t('settings.nip5.saveAddress') : t('constants.back')
            }
          />
          {!!name && (
            <CustomButton
              disabled={isLoading}
              actionFunction={removeNip5Information}
              buttonStyles={styles.removeButton}
              textStyles={[styles.removeText, { color: textColor }]}
              textContent={t('settings.nip5.removeAddress')}
            />
          )}
        </>
      )}
    </CustomKeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  globalContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  addressName: {
    fontSize: SIZES.huge,
    fontFamily: FONT.Title_Medium,
    includeFontPadding: false,
    marginTop: 28,
    textAlign: 'center',
  },
  placeholder: {
    opacity: 0.3,
  },
  addressDomain: {
    fontSize: SIZES.large,
    opacity: 0.5,
    includeFontPadding: false,
    textAlign: 'center',
    marginBottom: 40,
  },
  explainerText: {
    fontSize: SIZES.smedium,
    opacity: 0.7,
    lineHeight: 22,
    marginTop: 24,
    marginBottom: 24,
  },
  inputCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  inputDescriptor: {
    fontSize: SIZES.small,
    opacity: 0.6,
    paddingHorizontal: 10,
    paddingTop: 12,
    includeFontPadding: false,
  },
  inputContainer: {
    flexDirection: 'row',
  },
  divider: {
    height: 2,
    marginLeft: 10,
  },
  textInput: {
    flex: 1,
    paddingTop: 6,
    width: undefined,
    minWidth: 0,
    backgroundColor: 'transparent',
  },
  inputSuffix: {
    opacity: 0.5,
    paddingRight: 10,
    includeFontPadding: false,
  },
  statusIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pasteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  pasteText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  removeButton: {
    width: INSET_WINDOW_WIDTH,
    backgroundColor: 'transparent',
    // paddingVertical: 12,
  },
  removeText: {
    includeFontPadding: false,
  },
  statusText: {
    fontSize: SIZES.small,
    marginTop: 8,
    marginHorizontal: 10,
    includeFontPadding: false,
  },
});
