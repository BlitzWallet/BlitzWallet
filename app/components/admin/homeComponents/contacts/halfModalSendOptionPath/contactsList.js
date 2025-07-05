import {useNavigation} from '@react-navigation/native';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {CENTER, CONTENT_KEYBOARD_OFFSET, SIZES} from '../../../../../constants';
import {useMemo, useState} from 'react';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {useGlobalContacts} from '../../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useTranslation} from 'react-i18next';
import useUnmountKeyboard from '../../../../../hooks/useUnmountKeyboard';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import {KEYBOARDTIMEOUT} from '../../../../../constants/styles';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import {useImageCache} from '../../../../../../context-store/imageCache';
import ContactProfileImage from '../internalComponents/profileImage';
import {useGlobalInsets} from '../../../../../../context-store/insetsProvider';

export default function ChooseContactHalfModal() {
  const {theme, darkModeType} = useGlobalThemeContext();
  const {cache} = useImageCache();
  useUnmountKeyboard();
  const {decodedAddedContacts} = useGlobalContacts();
  const navigate = useNavigation();
  const [isKeyboardActive, setIskeyboardActive] = useState(false);
  const [inputText, setInputText] = useState('');
  const {t} = useTranslation();
  const {bottomPadding} = useGlobalInsets();

  useHandleBackPressNew();

  const contactElements = useMemo(() => {
    return decodedAddedContacts
      .filter(contact => {
        return (
          contact.name.toLowerCase().startsWith(inputText.toLowerCase()) ||
          (!contact.isLNURL &&
            contact.uniqueName
              .toLowerCase()
              .startsWith(inputText.toLowerCase()))
        );
      })
      .map((contact, id) => {
        return (
          <ContactElement
            key={contact.uuid}
            contact={contact}
            imgCache={cache}
          />
        );
      });
  }, [decodedAddedContacts, inputText, cache]);

  return (
    <CustomKeyboardAvoidingView
      useStandardWidth={true}
      useTouchableWithoutFeedback={true}>
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={t('wallet.contactsPage.header')}
      />
      <View style={styles.innerContainer}>
        <CustomSearchInput
          inputText={inputText}
          setInputText={setInputText}
          placeholderText={t('wallet.contactsPage.inputTextPlaceholder')}
          containerStyles={{marginBottom: 10}}
          onBlurFunction={() => {
            setIskeyboardActive(false);
          }}
          onFocusFunction={() => {
            setIskeyboardActive(true);
          }}
        />
        <ThemeText content={t('wallet.contactsPage.subHeader')} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: isKeyboardActive
              ? CONTENT_KEYBOARD_OFFSET
              : bottomPadding,
          }}>
          {contactElements}
        </ScrollView>
      </View>
    </CustomKeyboardAvoidingView>
  );

  function navigateToExpandedContact(contact) {
    Keyboard.dismiss();
    setTimeout(
      () => {
        navigate.navigate('SendAndRequestPage', {
          selectedContact: contact,
          paymentType: 'send',
          fromPage: 'halfModal',
        });
      },
      Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0,
    );
  }

  function ContactElement(props) {
    const {isConnectedToTheInternet} = useAppStatus();

    const {t} = useTranslation();
    const {backgroundOffset} = GetThemeColors();
    const contact = props.contact;

    return (
      <TouchableOpacity
        onLongPress={() => {
          if (!isConnectedToTheInternet) {
            navigate.navigate('ErrorScreen', {
              errorMessage: t('constants.internetError'),
            });
            return;
          }
        }}
        key={contact.uuid}
        onPress={() => navigateToExpandedContact(contact)}>
        <View style={{marginTop: 10}}>
          <View style={styles.contactRowContainer}>
            <View
              style={[
                styles.contactImageContainer,
                {
                  backgroundColor: backgroundOffset,
                  position: 'relative',
                },
              ]}>
              <ContactProfileImage
                updated={props.imgCache[contact.uuid]?.updated}
                uri={props.imgCache[contact.uuid]?.localUri}
                darkModeType={darkModeType}
                theme={theme}
              />
            </View>

            <View style={{width: '100%', flex: 1}}>
              <ThemeText
                CustomEllipsizeMode={'tail'}
                CustomNumberOfLines={1}
                content={
                  !!contact.name.length ? contact.name : contact.uniqueName
                }
              />
              <ThemeText
                CustomEllipsizeMode={'tail'}
                CustomNumberOfLines={1}
                styles={{
                  fontSize: SIZES.small,
                }}
                content={!!contact.name.length ? contact.uniqueName : ''}
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginTop: 20,
  },

  contactRowContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    ...CENTER,
  },

  contactImageContainer: {
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 30,
    marginRight: 10,
    overflow: 'hidden',
  },
  contactImage: {
    width: 25,
    height: 30,
  },
});
