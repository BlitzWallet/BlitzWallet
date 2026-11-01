import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CustomKeyboardAvoidingView } from '../../functions/CustomElements';
import { CENTER } from '../../constants';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import SendModal from '../../components/admin/homeComponents/sendBitcoin/sendModal';
import EmptyState from '../../functions/CustomElements/redesign/EmptyState';
import useContentWidth from '../../functions/CustomElements/redesign/useContentWidth';
import MobileMoneySendOverlay from '../../components/admin/homeComponents/homeLightning/mobileMoneySendOverlay';
import { useTheme } from '../../../context-store/theme';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useGlobalContacts } from '../../../context-store/globalContacts';
import { useImageCache } from '../../../context-store/imageCache';
import { useProcessedContacts } from '../../components/admin/homeComponents/contacts/contactsPageComponents/hooks';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import ListCard from '../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../functions/CustomElements/redesign/ListRow';
import SectionHeader from '../../functions/CustomElements/redesign/SectionHeader';
import ContactAvatarDisc from '../../components/admin/homeComponents/contacts/internalComponents/contactAvatar';

const noop = () => {};
const runCallback = callback => callback();

export default function SendList() {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { tokens } = useTheme();
  const { topPadding } = useGlobalInsets();
  const contentWidth = useContentWidth();
  const [showMobileMoney, setShowMobileMoney] = useState(false);
  const [backNav, setBackNav] = useState(null);
  const { decodedAddedContacts, contactsMessags } = useGlobalContacts();
  const { cache } = useImageCache();

  const contactInfoList = useProcessedContacts(
    decodedAddedContacts,
    contactsMessags,
  );

  // LNURL contacts stay in: unlike receive, they can be paid.
  const sortedContacts = useMemo(
    () =>
      [...contactInfoList]
        .sort((contactA, contactB) => {
          const updatedA = contactA?.lastUpdated || 0;
          const updatedB = contactB?.lastUpdated || 0;

          if (updatedA !== updatedB) return updatedB - updatedA;

          const nameA =
            contactA?.contact?.name || contactA?.contact?.uniqueName || '';
          const nameB =
            contactB?.contact?.name || contactB?.contact?.uniqueName || '';
          return nameA.localeCompare(nameB);
        })
        .map(item => item.contact),
    [contactInfoList],
  );

  const contactElements = useMemo(() => {
    return sortedContacts.map(contact => (
      <ListRow
        key={contact.uuid}
        lead={
          <ContactAvatarDisc
            name={contact.name || contact.uniqueName}
            seed={contact.uuid}
            updated={cache[contact.uuid]?.updated}
            uri={cache[contact.uuid]?.localUri}
          />
        }
        title={contact.name || t('constants.annonName')}
        sub={contact.isLNURL ? undefined : `@${contact.uniqueName}`}
        onPress={() =>
          navigate.navigate('SendAndRequestPage', {
            selectedContact: contact,
            paymentType: 'send',
            imageData: cache[contact.uuid],
          })
        }
        showChevron
      />
    ));
  }, [sortedContacts, cache, navigate, t]);

  const openMobileMoney = useCallback(() => setShowMobileMoney(true), []);
  const closeMobileMoney = useCallback(() => setShowMobileMoney(false), []);
  const openAddContact = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'addContacts',
      sliderHight: 0.7,
    });
  }, [navigate]);

  return (
    <CustomKeyboardAvoidingView
      useStandardWidth={false}
      styles={styles.screen}
      useTouchableWithoutFeedback={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('constants.send')} />
        {sortedContacts.length ? (
          <CustomScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
          >
            <SectionHeader title={t('screens.inAccount.sendList.contacts')} />
            {!!contactElements.length && <ListCard>{contactElements}</ListCard>}
          </CustomScrollView>
        ) : (
          <View style={styles.empty}>
            <EmptyState
              icon={'Send'}
              title={t('screens.inAccount.sendList.emptyTitle')}
              sub={t('screens.inAccount.sendList.emptySub')}
              onRetry={openAddContact}
              retryText={t('contacts.contactsPage.addContactButton')}
            />
          </View>
        )}
      </View>
      <SendModal contentWidth={contentWidth} onPhonePress={openMobileMoney} />
      {showMobileMoney && (
        <View
          style={[
            styles.overlay,
            { backgroundColor: tokens.ground, paddingTop: topPadding },
          ]}
        >
          <View style={[styles.overlayTopBar, { width: contentWidth }]}>
            <TopBar title="" onBack={backNav?.onPress} />
          </View>
          <View style={styles.overlayBody}>
            <MobileMoneySendOverlay
              visible={true}
              onClose={closeMobileMoney}
              handleBackPressFunction={runCallback}
              navigate={navigate}
              setBackNav={setBackNav}
              setContentHeight={noop}
            />
          </View>
        </View>
      )}
    </CustomKeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  container: { flex: 1, ...CENTER },
  list: { paddingBottom: 24 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  overlayTopBar: { ...CENTER },
  overlayBody: { flex: 1 },
});
