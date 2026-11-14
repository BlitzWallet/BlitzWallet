import { StyleSheet, useWindowDimensions, View } from 'react-native';
import GlobalThemeView from '../../functions/CustomElements/globalThemeView';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../constants';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import { useTranslation } from 'react-i18next';
import IconButton from '../../functions/CustomElements/redesign/IconButton';
import { useMemo } from 'react';
import { useGlobalContacts } from '../../../context-store/globalContacts';
import { useProcessedContacts } from '../../components/admin/homeComponents/contacts/contactsPageComponents/hooks';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import SectionHeader from '../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../functions/CustomElements/redesign/ListCard';
import { useImageCache } from '../../../context-store/imageCache';
import ListRow from '../../functions/CustomElements/redesign/ListRow';
import ContactAvatar from '../../components/admin/homeComponents/contacts/internalComponents/contactAvatar';
import EmptyState from '../../functions/CustomElements/redesign/EmptyState';
import { useNavigation } from '@react-navigation/native';
import ReceiveModal from '../../components/admin/homeComponents/receiveBitcoin/ReceiveModal';
import { formatDisplayName } from '../../components/admin/homeComponents/contacts/utils/formatListDisplayName';

// Receive (Receive.dc.html): request from a contact first, then the
// "another wallet or exchange" panel. A contact opens the contact Request
// page (same screen as Pay a contact).
export default function ReceiveHomeRedesign() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { decodedAddedContacts, contactsMessags } = useGlobalContacts();
  const { cache } = useImageCache();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const contactInfoList = useProcessedContacts(
    decodedAddedContacts,
    contactsMessags,
  );

  const sortedContacts = useMemo(() => {
    return contactInfoList
      .sort((contactA, contactB) => {
        const updatedA = contactA?.lastUpdated || 0;
        const updatedB = contactB?.lastUpdated || 0;

        if (updatedA !== updatedB) {
          return updatedB - updatedA;
        }

        const nameA = contactA?.name || contactA?.uniqueName || '';
        const nameB = contactB?.name || contactB?.uniqueName || '';
        return nameA.localeCompare(nameB);
      })
      .map(contact => contact.contact)
      .filter(contact => !contact.isLNURL);
  }, [contactInfoList]);

  const contactElements = useMemo(() => {
    return sortedContacts.map(contact => (
      <ListRow
        key={contact.uuid}
        lead={
          <ContactAvatar
            name={contact.name || contact?.uniqueName}
            seed={contact.uuid}
            updated={cache[contact.uuid]?.updated}
            uri={cache[contact.uuid]?.localUri}
          />
        }
        title={formatDisplayName(contact) || t('constants.annonName')}
        sub={`@${contact.uniqueName}`}
        onPress={() =>
          navigate.navigate('SendAndRequestPage', {
            selectedContact: contact,
            paymentType: 'request',
            imageData: cache[contact.uuid],
          })
        }
        showChevron
      />
    ));
  }, [sortedContacts, cache, navigate, t]);

  return (
    <GlobalThemeView useStandardWidth={false} styles={styles.screen}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('constants.receive')}
          right={
            <IconButton
              icon="QrCode"
              label="receive.showMyQr"
              onPress={() =>
                navigate.navigate('ShowProfileQr', { showButton: false })
              }
            />
          }
        />
        {sortedContacts.length ? (
          <CustomScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            <SectionHeader title={t('receive.requestFromContact')} />
            {!!contactElements.length && <ListCard>{contactElements}</ListCard>}
          </CustomScrollView>
        ) : (
          <View style={styles.empty}>
            <EmptyState
              icon={'UsersRound'}
              title={t('receive.emptyTitle')}
              sub={t('receive.emptySub')}
              retryText={t('receive.addContact')}
              onRetry={() =>
                navigate.navigate('CustomHalfModal', {
                  wantedContent: 'addContacts',
                  sliderHight: 0.8,
                })
              }
            />
          </View>
        )}
      </View>
      <ReceiveModal contentWidth={contentWidth} />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  container: { flex: 1, ...CENTER },
  list: { paddingBottom: 24 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
