import {
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { COLORS } from '../../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { encriptMessage } from '../../../../../functions/messaging/encodingAndDecodingMessages';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../../hooks/themeColors';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useKeysContext } from '../../../../../../context-store/keys';

import { useTranslation } from 'react-i18next';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';

export default function ContactsPageLongPressActions({
  route: {
    params: { contact },
  },
}) {
  const navigate = useNavigation();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset, transparentOveraly } =
    GetThemeColors();
  const {
    decodedAddedContacts,
    globalContactsInformation,
    toggleGlobalContactsInformation,
    deleteContact,
  } = useGlobalContactsInfo();

  const { t } = useTranslation();

  return (
    <TouchableWithoutFeedback onPress={() => navigate.goBack()}>
      <View
        style={[
          styles.globalContainer,
          { backgroundColor: transparentOveraly },
        ]}
      >
        <TouchableWithoutFeedback>
          <View
            style={[
              styles.content,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : backgroundColor,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.btn}
              onPress={() => {
                toggleContactPin(contact);
                navigate.goBack();
              }}
            >
              <ThemeText
                styles={styles.btnText}
                content={t(`constants.${contact.isFavorite ? 'unpin' : 'pin'}`)}
              />
            </TouchableOpacity>

            <View
              style={[
                styles.divider,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                },
              ]}
            />

            <TouchableOpacity
              activeOpacity={0.6}
              style={styles.btn}
              onPress={() => {
                deleteContact(contact);
                navigate.goBack();
              }}
            >
              <ThemeText
                styles={styles.btnText}
                content={t('constants.delete')}
              />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );

  function toggleContactPin(contact) {
    const newAddedContacts = decodedAddedContacts.map(savedContacts => {
      if (savedContacts.uuid === contact.uuid) {
        return { ...savedContacts, isFavorite: !savedContacts.isFavorite };
      } else return savedContacts;
    });

    toggleGlobalContactsInformation(
      {
        addedContacts: encriptMessage(
          contactsPrivateKey,
          publicKey,
          JSON.stringify(newAddedContacts),
        ),
        myProfile: { ...globalContactsInformation.myProfile },
      },
      true,
    );
  }
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: INSET_WINDOW_WIDTH,
    maxWidth: 300,
    borderRadius: 16,
    overflow: 'hidden',
  },
  divider: {
    height: 2,
    width: '100%',
  },
  btn: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    textAlign: 'center',
    includeFontPadding: false,
  },
});
