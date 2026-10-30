import { StyleSheet, useWindowDimensions, View } from 'react-native';
import GlobalThemeView from '../../functions/CustomElements/globalThemeView';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../constants';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import { useTranslation } from 'react-i18next';
import IconButton from '../../functions/CustomElements/redesign/IconButton';
import SearchField from '../../functions/CustomElements/redesign/SearchField';
import { useMemo, useState } from 'react';
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
  const [name, setName] = useState('');

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
    const search = name.trim().toLowerCase();
    return sortedContacts
      .filter(
        contact =>
          !search ||
          (contact.name || t('constants.annonName'))
            ?.toLowerCase()
            .includes(search) ||
          contact.uniqueName?.toLowerCase().includes(search),
      )
      .map(contact => (
        <ListRow
          key={contact.uuid}
          lead={
            <ContactAvatar
              name={contact.name || t('constants.annonName')}
              seed={contact.uuid}
              updated={cache[contact.uuid]?.updated}
              uri={cache[contact.uuid]?.localUri}
            />
          }
          title={contact.name || t('constants.annonName')}
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
  }, [sortedContacts, name, cache, navigate, t]);

  return (
    <GlobalThemeView useStandardWidth={false} styles={styles.screen}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('constants.receive')}
          right={
            <IconButton
              icon="QrCode"
              label="receive.showMyQr"
              onPress={() => navigate.navigate('ShowProfileQr')}
            />
          }
        />
        {sortedContacts.length ? (
          <>
            <View style={styles.search}>
              <SearchField
                value={name}
                onChangeText={setName}
                pill
                placeholder={t('constants.search')}
              />
            </View>
            <CustomScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
            >
              <SectionHeader title={t('receive.requestFromContact')} />
              {!!contactElements.length && (
                <ListCard>{contactElements}</ListCard>
              )}
            </CustomScrollView>
          </>
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
  search: { marginTop: 20 },
  list: { paddingBottom: 24 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
