import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  NOSTR_NAME_REGEX,
} from '../../../../../constants';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../constants/theme';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useState } from 'react';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import { addNip5toCollection, isValidNip5Name } from '../../../../../../db';
import { npubToHex } from '../../../../../functions/nostr';
import { copyToClipboard } from '../../../../../functions';
import { useToast } from '../../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import { keyboardGoBack } from '../../../../../functions/customNavigation';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function Nip5VerificationPage() {
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const [isLoading, setIsLoading] = useState('');
  const { name, pubkey } = masterInfoObject?.nip5Settings;

  const { t } = useTranslation();
  const [inputs, setInputs] = useState({
    name: name || '',
    pubkey: pubkey || '',
  });

  const handleInputText = (value, identifier) => {
    setInputs(prev => ({
      ...prev,
      [identifier]: value,
    }));
  };
  const doesInputMatchSaved = inputs.name === name && inputs.pubkey === pubkey;

  const saveNip5Information = async () => {
    try {
      setIsLoading(true);

      if (doesInputMatchSaved) {
        keyboardGoBack(navigate);
        return;
      }
      if (!inputs.name) throw new Error(t('settings.nip5.noNameError'));
      if (!inputs.pubkey) throw new Error(t('settings.nip5.noPubKey'));

      if (inputs.name.length > 60)
        throw new Error(t('settings.nip5.nameLengthError'));

      const parsedName = inputs.name.trim();

      if (!NOSTR_NAME_REGEX.test(parsedName))
        throw new Error(t('settings.nip5.regexError'));
      const formattedHexData = npubToHex(inputs.pubkey);
      if (!formattedHexData?.didWork) {
        navigate.navigate('ErrorScreen', {
          errorMessage: formattedHexData.error,
          useTranslationString: true,
        });
      }

      const isNameFree = await isValidNip5Name(inputs.name);
      if (!isNameFree) throw new Error(t('settings.nip5.takenNameError'));

      if (!formattedHexData.data || !parsedName) {
        throw new Error(t('settings.nip5.dataIsInvalid'));
      }

      toggleMasterInfoObject({
        nip5Settings: {
          name: parsedName,
          pubkey: formattedHexData.data,
        },
      });
      await addNip5toCollection(
        {
          name: parsedName,
          nameLower: parsedName.toLowerCase(),
          pubkey: formattedHexData.data,
          didUpdate: true,
        },
        masterInfoObject.uuid,
      );
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
  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomKeyboardAvoidingView useTouchableWithoutFeedback={true}>
        <View style={StyleSheet.absoluteFill}>
          <CustomSettingsTopBar
            shouldDismissKeyboard={true}
            label={t('settings.nip5.title')}
          />
          <ScrollView showsVerticalScrollIndicator={false}>
            <ThemeText
              styles={styles.explainerText}
              content={t('settings.nip5.desc')}
            />

            <View style={styles.inputRow}>
              <ThemeText
                styles={styles.inputDescriptor}
                content={t('settings.nip5.usernameInputLabel')}
              />
              <CustomSearchInput
                inputText={inputs.name}
                setInputText={e => handleInputText(e, 'name')}
                placeholderText={t('settings.nip5.usernameInputPlaceholder')}
              />
              <ThemeText
                styles={styles.textCoount}
                content={`${inputs.name.length}/60`}
              />
            </View>
            <View style={styles.inputRow}>
              <ThemeText
                styles={styles.inputDescriptor}
                content={t('settings.nip5.publicKeyLabel')}
              />
              <CustomSearchInput
                inputText={inputs.pubkey}
                setInputText={e => handleInputText(e, 'pubkey')}
                placeholderText={t('settings.nip5.publicKeyPlaceholder')}
              />
            </View>
            <TouchableOpacity
              style={styles.nip5AddressContainer}
              onPress={() => {
                if (!inputs.name.length) return;
                copyToClipboard(`${inputs.name}@blitzwalletapp.com`, showToast);
              }}
            >
              <ThemeIcon size={25} iconName={'Copy'} />
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.nip5AddressText}
                content={`${
                  inputs.name.length ? inputs.name : '...'
                }@blitzwalletapp.com`}
              />
            </TouchableOpacity>
          </ScrollView>
          <CustomButton
            useLoading={isLoading}
            actionFunction={saveNip5Information}
            buttonStyles={{
              ...CENTER,
              marginBottom: CONTENT_KEYBOARD_OFFSET,
              marginTop: CONTENT_KEYBOARD_OFFSET,
            }}
            textContent={
              doesInputMatchSaved
                ? t('constants.back')
                : (inputs.name || inputs.pubkey) && name && pubkey
                ? t('constants.update')
                : t('constants.save')
            }
          />
        </View>
      </CustomKeyboardAvoidingView>
    </GlobalThemeView>
  );
}
const styles = StyleSheet.create({
  contentcontainer: {},
  explainerText: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 50,
  },
  inputRow: {
    width: '90%',
    ...CENTER,
    marginVertical: 10,
  },
  inputDescriptor: {
    marginBottom: 8,
    includeFontPadding: false,
  },
  textCoount: {
    width: '100%',
    textAlign: 'right',
    marginTop: 5,
  },
  nip5AddressContainer: {
    width: '90%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    ...CENTER,
    marginBottom: 10,
  },
  nip5AddressText: {
    fontSize: SIZES.large,
    textAlign: 'center',
    flexShrink: 1,
    marginLeft: 5,
  },
});
