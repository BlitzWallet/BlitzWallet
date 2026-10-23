import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import {
  CENTER,
  MAX_WEB_CONTENT_WIDTH,
  NOSTR_NAME_REGEX,
} from '../../../../../constants';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { FONT } from '../../../../../constants/theme';
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
import getClipboardText from '../../../../../functions/getClipboardText';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../../hooks/themeColors';
import { nip19 } from 'nostr-tools';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../../functions/CustomElements/redesign/IconButton';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import TextButton from '../../../../../functions/CustomElements/redesign/TextButton';

const NIP5_DOMAIN = '@blitzwalletapp.com';
const MAX_NAME_LENGTH = 60;

export default function Nip5VerificationPage() {
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { mode } = useGlobalThemeContext();
  const { tokens } = GetThemeColors();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
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

      const didSave = await addNip5toCollection(
        {
          name: parsedName,
          nameLower: parsedName.toLowerCase(),
          pubkey: parsedPubkey.data,
          didUpdate: true,
        },
        masterInfoObject.uuid,
      );
      if (!didSave) throw new Error(t('settings.nip5.dataIsInvalid'));
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
    navigate.navigate('ConfirmDialog', {
      title: t('settings.nip5.removeTitle', {
        address: `${name}${NIP5_DOMAIN}`,
      }),
      message: t('settings.nip5.removeSub'),
      confirmLabel: t('constants.remove'),
      cancelLabel: t('constants.cancel'),
      onConfirm: async () => {
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

  const nameStatusText = {
    available: !isOwnName && {
      text: t('settings.nip5.available'),
      color: tokens.link,
    },
    taken: { text: t('settings.nip5.takenNameError'), color: tokens.danger },
    invalid: { text: t('settings.nip5.regexError'), color: tokens.danger },
  }[nameStatus];

  const showPubkeyError = !!inputs.pubkey.trim() && !parsedPubkey.didWork;
  // Saved and unchanged: no main button, the header has back.
  const showSaveButton = isEditing || !name;

  return (
    <CustomKeyboardAvoidingView
      globalThemeViewStyles={styles.globalContainer}
      isKeyboardActive={!!focusedInput}
      useLocalPadding={true}
      useStandardWidth={true}
    >
      <View style={{ flex: 1, width: contentWidth, ...CENTER }}>
        <TopBar
          title={t('settings.nip5.title')}
          shouldDismissKeyboard={true}
          right={<IconButton icon={'Info'} onPress={openInfo} />}
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps={'handled'}
        >
          <View style={styles.preview}>
            <ThemeText
              CustomNumberOfLines={1}
              styles={[
                styles.addressName,
                !parsedName && { color: tokens.muted },
              ]}
              content={
                parsedName || t('settings.nip5.usernameInputPlaceholder')
              }
            />
            <ThemeText
              styles={[styles.addressDomain, { color: tokens.muted }]}
              content={NIP5_DOMAIN}
            />
            {isSaved && (
              <CustomButton
                size="small"
                tone="secondary"
                icon="Copy"
                textContent={t('constants.copy')}
                actionFunction={() =>
                  copyToClipboard(`${name}${NIP5_DOMAIN}`, showToast)
                }
                buttonStyles={styles.copyButton}
                textStyles={styles.copyText}
              />
            )}
          </View>
          <View
            style={[
              styles.inputCard,
              { backgroundColor: tokens.surface, marginTop: isSaved ? 24 : 28 },
            ]}
          >
            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <ThemeText
                  styles={[styles.fieldLabel, { color: tokens.muted }]}
                  content={t('settings.nip5.usernameInputLabel')}
                />
                <CustomSearchInput
                  inputText={inputs.name}
                  setInputText={e => handleInputText(e, 'name')}
                  placeholderText={t('settings.nip5.usernameInputPlaceholder')}
                  placeholderTextColor={tokens.muted}
                  maxLength={MAX_NAME_LENGTH}
                  textInputStyles={{ ...styles.textInput, color: tokens.ink }}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditingFunction={() =>
                    pubkeyInputRef.current?.focus()
                  }
                  {...focusHandlers('name')}
                />
              </View>
              {nameStatus === 'checking' ? (
                <ActivityIndicator size="small" color={tokens.muted} />
              ) : nameStatus === 'available' && !isOwnName ? (
                <ThemeIcon
                  redesign
                  iconName="Check"
                  size={20}
                  colorOverride={tokens.link}
                />
              ) : null}
            </View>
            <View
              style={[styles.divider, { backgroundColor: tokens.divider }]}
            />
            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <ThemeText
                  styles={[styles.fieldLabel, { color: tokens.muted }]}
                  content={t('settings.nip5.publicKeyLabel')}
                />
                <CustomSearchInput
                  textInputRef={pubkeyInputRef}
                  inputText={inputs.pubkey}
                  setInputText={e => handleInputText(e, 'pubkey')}
                  placeholderText={t('settings.nip5.publicKeyPlaceholder')}
                  placeholderTextColor={tokens.muted}
                  textInputStyles={{ ...styles.textInput, color: tokens.ink }}
                  returnKeyType="done"
                  {...focusHandlers('pubkey')}
                />
              </View>
              <TouchableOpacity
                onPress={handlePaste}
                style={[styles.pasteButton, { backgroundColor: tokens.disc }]}
              >
                <ThemeText
                  styles={[styles.pasteText, { color: tokens.link }]}
                  content={t('constants.paste')}
                />
              </TouchableOpacity>
            </View>
          </View>
          {!!nameStatusText && (
            <ThemeText
              styles={[styles.statusText, { color: nameStatusText.color }]}
              content={nameStatusText.text}
            />
          )}
          {showPubkeyError && (
            <ThemeText
              styles={[
                styles.statusText,
                { color: mode !== 'dim' ? tokens.danger : tokens.ink },
              ]}
              content={t(parsedPubkey.error)}
            />
          )}
        </CustomScrollView>
        {!focusedInput && (
          <View style={styles.bottomButtons}>
            {showSaveButton && (
              <CustomButton
                size="regular"
                useLoading={isLoading}
                disabled={!canSave}
                actionFunction={saveNip5Information}
                textContent={t('settings.nip5.saveAddress')}
              />
            )}
            {!!name && (
              <TextButton
                textStyle={{
                  color: mode !== 'dim' ? tokens.danger : tokens.ink,
                }}
                disabled={isLoading}
                onPress={removeNip5Information}
                text={t('settings.nip5.removeAddress')}
                align="center"
                accessibilityLabel={t('settings.nip5.removeAddress')}
              />
            )}
          </View>
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  globalContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  preview: {
    marginTop: 28,
    alignItems: 'center',
  },
  addressName: {
    fontFamily: FONT.Title_Medium,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.64,
    includeFontPadding: false,
    textAlign: 'center',
  },
  addressDomain: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
    textAlign: 'center',
  },
  copyButton: {
    marginTop: 8,
  },
  copyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  inputCard: {
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  fieldRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  divider: {
    height: 1,
  },
  textInput: {
    width: '100%',
    padding: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    borderRadius: 0,
    fontSize: 16,
    height: 24,
    backgroundColor: 'transparent',
  },
  pasteButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  statusText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    marginHorizontal: 4,
    includeFontPadding: false,
  },
  bottomButtons: {
    gap: 12,
  },
  removeButton: {
    backgroundColor: 'transparent',
  },
});
