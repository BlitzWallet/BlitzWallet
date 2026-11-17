import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { ThemeText } from '../../../../functions/CustomElements';
import { FONT } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import CustomButton from '../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import { useGlobalContactsInfo } from '../../../../../context-store/globalContacts';

export default function AddContactsPage({ selectedContact }) {
  const newContact = selectedContact;
  const { tokens } = GetThemeColors();
  const { addContact } = useGlobalContactsInfo();
  const { t } = useTranslation();

  const name = newContact?.name?.trim() || t('constants.annonName');
  const username = newContact?.uniqueName;
  const lnurl = newContact?.isLNURL ? newContact?.receiveAddress : null;
  const bio = newContact?.bio?.trim() || t('constants.noBioSet');
  // Lightning address contacts have no username, so their address goes there.
  const subtitle = username ? `@${username}` : lnurl;

  return (
    <View style={styles.container}>
      <ThemeText styles={styles.nameText} content={name} />

      {!!subtitle && (
        <ThemeText
          variant="body"
          styles={[styles.subtitleText, { color: tokens.muted }]}
          content={subtitle}
        />
      )}

      <View style={[styles.bioCard, { backgroundColor: tokens.surface }]}>
        <ThemeText
          variant="hint"
          content={t('contacts.editMyProfilePage.bioInputDesc')}
        />
        <CustomScrollView
          style={styles.bioScroll}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          <ThemeText variant="body" content={bio} />
        </CustomScrollView>
      </View>
      <CustomButton
        actionFunction={() => {
          addContact(newContact);
        }}
        buttonStyles={styles.addButton}
        textContent={t('contacts.addContactsHalfModal.title')}
        size={'regular'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, width: '100%' },
  nameText: {
    marginTop: 14,
    fontFamily: FONT.Title_Regular,
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.22,
    textAlign: 'center',
    includeFontPadding: false,
  },
  subtitleText: {
    textAlign: 'center',
  },
  bioCard: {
    marginTop: 28,
    marginBottom: 20,
    width: '100%',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bioScroll: { maxHeight: 120, marginTop: 2 },
  addButton: { marginTop: 'auto' },
});
