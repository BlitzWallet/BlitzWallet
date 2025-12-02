import { ScrollView, StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import CustomButton from '../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
export default function AddContactsPage({ selectedContact }) {
  const newContact = selectedContact;
  const { textInputBackground, textInputColor } = GetThemeColors();
  const { addContact } = useGlobalContacts();
  const { t } = useTranslation();

  const name = newContact?.name?.trim() || t('constants.annonName');
  const username = newContact?.uniqueName;
  const lnurl = newContact?.isLNURL ? newContact?.receiveAddress : null;
  const bio = newContact?.bio?.trim() || t('constants.noBioSet');

  return (
    <View style={styles.container}>
      <ThemeText styles={styles.nameText} content={name} />

      {username && (
        <ThemeText styles={styles.usernameText} content={`@${username}`} />
      )}

      {lnurl && (
        <View style={styles.infoContainer}>
          <ThemeText styles={styles.infoLabel} content={'LNURL Address'} />
          <ThemeText styles={styles.infoValue} content={lnurl} />
        </View>
      )}

      <View
        style={[styles.bioContainer, { backgroundColor: textInputBackground }]}
      >
        <ScrollView
          contentContainerStyle={{
            alignItems: 'center',
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          <ThemeText
            styles={[styles.bioText, { color: textInputColor }]}
            content={bio}
          />
        </ScrollView>
      </View>
      <CustomButton
        actionFunction={() => {
          addContact(newContact);
        }}
        buttonStyles={{ marginTop: 'auto' }}
        textContent={t('contacts.editMyProfilePage.addContactBTN')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center' },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  backButtonContainer: {
    marginRight: 'auto',
  },

  scrollBody: {
    alignItems: 'center',
    paddingBottom: 40,
    flexGrow: 1,
  },

  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 125,
    overflow: 'hidden',
    marginBottom: 12,
    ...CENTER,
  },

  nameText: {
    fontSize: SIZES.large,
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: 5,
    includeFontPadding: false,
  },
  usernameText: {
    fontSize: SIZES.medium,
    textAlign: 'center',
    marginBottom: 15,
    includeFontPadding: false,
  },

  infoContainer: {
    width: '90%',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: SIZES.smedium,
    opacity: 0.6,
    marginBottom: 4,
    includeFontPadding: false,
  },

  infoValue: {
    includeFontPadding: false,
    marginBottom: 10,
  },

  bioContainer: {
    width: '90%',
    minHeight: 60,
    maxHeight: 80,
    borderRadius: 8,
    padding: 10,
    backgroundColor: COLORS.darkModeText,
    ...CENTER,
  },

  bioText: {
    textAlign: 'center',
    marginBottom: 'auto',
    marginTop: 'auto',
  },
});
