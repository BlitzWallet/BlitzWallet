import { useNavigation } from '@react-navigation/native';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
} from '../../../../../constants';
import { useCallback, useMemo, useState } from 'react';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { useGlobalContacts } from '../../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import useUnmountKeyboard from '../../../../../hooks/useUnmountKeyboard';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import { KEYBOARDTIMEOUT } from '../../../../../constants/styles';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { useImageCache } from '../../../../../../context-store/imageCache';
import ContactProfileImage from '../internalComponents/profileImage';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { formatDisplayName } from '../utils/formatListDisplayName';

export default function ChooseContactHalfModal() {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { cache } = useImageCache();
  useUnmountKeyboard();
  const { decodedAddedContacts } = useGlobalContacts();
  const navigate = useNavigation();
  const [isKeyboardActive, setIskeyboardActive] = useState(false);
  const [inputText, setInputText] = useState('');
  const { t } = useTranslation();
  const { bottomPadding } = useGlobalInsets();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { isConnectedToTheInternet } = useAppStatus();

  const navigateToExpandedContact = useCallback((contact, imageData) => {
    setTimeout(
      () => {
        navigate.navigate('SendAndRequestPage', {
          selectedContact: contact,
          paymentType: 'send',
          imageData,
          fromPage: 'halfModal',
        });
      },
      Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0,
    );
    Keyboard.dismiss();
  }, []);

  const sortedContacts = useMemo(() => {
    return decodedAddedContacts.sort((contactA, contactB) => {
      const nameA = contactA?.name || contactA?.uniqueName || '';
      const nameB = contactB?.name || contactB?.uniqueName || '';
      return nameA.localeCompare(nameB);
    });
  }, [decodedAddedContacts]);

  const filteredContacts = useMemo(() => {
    return sortedContacts.filter(contact => {
      return (
        contact.name.toLowerCase().startsWith(inputText.toLowerCase()) ||
        (!contact.isLNURL &&
          contact.uniqueName
            ?.toLowerCase()
            ?.startsWith(inputText.toLowerCase()))
      );
    });
  }, [sortedContacts, inputText, cache]);

  const contactElements = useMemo(() => {
    return filteredContacts.map(item => {
      const contact = item;

      return (
        <TouchableOpacity
          style={styles.contactRowContainer}
          onLongPress={() => {
            if (!isConnectedToTheInternet) {
              navigate.navigate('ErrorScreen', {
                errorMessage: t('errormessages.nointernet'),
              });
              return;
            }
          }}
          key={contact.uuid}
          onPress={() =>
            navigateToExpandedContact(contact, cache[contact.uuid])
          }
        >
          <View
            style={[
              styles.contactImageContainer,
              {
                backgroundColor: backgroundOffset,
              },
            ]}
          >
            <ContactProfileImage
              updated={cache[contact.uuid]?.updated}
              uri={cache[contact.uuid]?.localUri}
              darkModeType={darkModeType}
              theme={theme}
            />
          </View>

          <View style={styles.nameContainer}>
            <ThemeText
              CustomEllipsizeMode={'tail'}
              CustomNumberOfLines={1}
              content={formatDisplayName(contact) || contact.uniqueName || ''}
            />
          </View>
        </TouchableOpacity>
      );
    });
  }, [
    filteredContacts,
    isConnectedToTheInternet,
    t,
    backgroundOffset,
    navigateToExpandedContact,
    cache,
  ]);

  const memorizedKeyboardStyle = useMemo(() => {
    return {
      paddingBottom: isKeyboardActive ? CONTENT_KEYBOARD_OFFSET : 0,
    };
  }, [isKeyboardActive]);

  return (
    <CustomKeyboardAvoidingView
      useStandardWidth={true}
      globalThemeViewStyles={memorizedKeyboardStyle}
      useTouchableWithoutFeedback={true}
    >
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={t('wallet.contactsPage.header')}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        stickyHeaderIndices={[0]}
        contentContainerStyle={{
          ...styles.innerContainer,
          paddingBottom: bottomPadding,
        }}
      >
        <CustomSearchInput
          inputText={inputText}
          setInputText={setInputText}
          placeholderText={t('wallet.contactsPage.inputTextPlaceholder')}
          containerStyles={{
            paddingBottom: CONTENT_KEYBOARD_OFFSET,
            backgroundColor,
          }}
          onBlurFunction={() => {
            setIskeyboardActive(false);
          }}
          onFocusFunction={() => {
            setIskeyboardActive(true);
          }}
        />
        <ThemeText content={t('wallet.contactsPage.subHeader')} />
        {contactElements}
      </ScrollView>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    paddingTop: 10,
    flexGrow: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },

  contactRowContainer: {
    marginTop: 10,
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
  nameContainer: { width: '100%', flex: 1 },
});
