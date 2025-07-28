import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  NOSTR_NAME_REGEX,
} from '../../../../../constants';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {INSET_WINDOW_WIDTH, SIZES} from '../../../../../constants/theme';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useState} from 'react';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useNavigation} from '@react-navigation/native';
import {addNip5toCollection, isValidNip5Name} from '../../../../../../db';
import {npubToHex} from '../../../../../functions/nostr';
import {copyToClipboard} from '../../../../../functions';
import {useToast} from '../../../../../../context-store/toastManager';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';

export default function Nip5VerificationPage() {
  const {showToast} = useToast();
  const navigate = useNavigation();
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const [isLoading, setIsLoading] = useState('');
  const {name, pubkey} = masterInfoObject?.nip5Settings;

  console.log(masterInfoObject?.nip5Settings);
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

  const saveNip5Information = async () => {
    try {
      setIsLoading(true);
      if (!inputs.name) throw new Error('Name cannot be empty.');
      if (!inputs.pubkey) throw new Error('Public key cannot be empty.');

      if (inputs.name === name && inputs.pubkey === pubkey) return;
      if (inputs.name.length > 60)
        throw new Error('Name must be less than 60 characters');

      const parsedName = inputs.name.trim();

      if (!NOSTR_NAME_REGEX.test(parsedName))
        throw new Error('Name can only include letters or numbers.');
      const formattedHexData = npubToHex(inputs.pubkey);
      if (!formattedHexData?.didWork) {
        navigate.navigate('ErrorScreen', {
          errorMessage: formattedHexData.error,
        });
      }

      const isNameFree = await isValidNip5Name(inputs.name);
      if (!isNameFree) throw new Error('Name already taken');

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
        errorMessage:
          'NIP-05 added successfully! Please note that it may take up to 24 hours to appear, as the list is updated once per day.',
      });
    } catch (err) {
      console.log('Error saving nip5 information', err);
      navigate.navigate('ErrorScreen', {errorMessage: err.message});
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
            label={'Nip5 Verification'}
          />
          <ScrollView showsVerticalScrollIndicator={false}>
            <ThemeText
              styles={styles.explainerText}
              content={
                'Nip5 turns your long Npub into a small email-like address, similar to a lightning address.'
              }
            />

            <View style={styles.inputRow}>
              <ThemeText styles={styles.inputDescriptor} content={'Username'} />
              <CustomSearchInput
                inputText={inputs.name}
                setInputText={e => handleInputText(e, 'name')}
                placeholderText="Satoshi..."
              />
              <ThemeText
                styles={styles.textCoount}
                content={`${inputs.name.length}/60`}
              />
            </View>
            <View style={styles.inputRow}>
              <ThemeText
                styles={styles.inputDescriptor}
                content={'Public key'}
              />
              <CustomSearchInput
                inputText={inputs.pubkey}
                setInputText={e => handleInputText(e, 'pubkey')}
                placeholderText="Npub..."
              />
            </View>
            <TouchableOpacity
              style={styles.nip5AddressContainer}
              onPress={() => {
                if (!inputs.name.length) return;
                copyToClipboard(`${inputs.name}@blitz-wallet.com`, showToast);
              }}>
              <ThemeImage
                styles={{width: 25, height: 25}}
                lightModeIcon={ICONS.clipboardBlue}
                darkModeIcon={ICONS.clipboardBlue}
                lightsOutIcon={ICONS.clipboardLight}
              />
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.nip5AddressText}
                content={`${
                  inputs.name.length ? inputs.name : '...'
                }@blitz-wallet.com`}
              />
            </TouchableOpacity>
          </ScrollView>
          <CustomButton
            useLoading={isLoading}
            actionFunction={saveNip5Information}
            buttonStyles={{...CENTER, marginBottom: CONTENT_KEYBOARD_OFFSET}}
            textContent={inputs.name || inputs.pubkey ? 'Update' : 'Save'}
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
    marginBottom: 10,
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
  },
});
