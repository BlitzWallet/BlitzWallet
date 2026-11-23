import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { CustomKeyboardAvoidingView } from '../../functions/CustomElements';
import { CENTER } from '../../constants';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import SendModal from '../../components/admin/homeComponents/sendBitcoin/sendModal';
import EmptyState from '../../functions/CustomElements/redesign/EmptyState';
import useContentWidth from '../../functions/CustomElements/redesign/useContentWidth';
import { useGlobalContacts } from '../../../context-store/globalContacts';
import { useImageCache } from '../../../context-store/imageCache';
import { useProcessedContacts } from '../../components/admin/homeComponents/contacts/contactsPageComponents/hooks';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import ListCard from '../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../functions/CustomElements/redesign/ListRow';
import SectionHeader from '../../functions/CustomElements/redesign/SectionHeader';
import ContactAvatarDisc from '../../components/admin/homeComponents/contacts/internalComponents/contactAvatar';
import { formatDisplayName } from '../../components/admin/homeComponents/contacts/utils/formatListDisplayName';
import { FADE } from '../../functions/CustomElements/redesign/BottomFade';
import { FADE_TOP } from '../../functions/CustomElements/redesign/TopFade';

export default function SendList() {
  const { t } = useTranslation();
  const navigate = useNavigation();
  // Set when Send was opened from the Bitcoin or Dollars page.
  const preSelectedPaymentMethod = useRoute().params?.preSelectedPaymentMethod;
  const contentWidth = useContentWidth();
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
            address={contact.receiveAddress}
            updated={cache[contact.uuid]?.updated}
            uri={cache[contact.uuid]?.localUri}
          />
        }
        title={formatDisplayName(contact) || t('constants.annonName')}
        sub={`${
          contact.isLNURL ? contact.receiveAddress : '@' + contact.uniqueName
        }`}
        onPress={() =>
          navigate.navigate('SendAndRequestPage', {
            selectedContact: contact,
            paymentType: 'send',
            imageData: cache[contact.uuid],
            selectedPaymentMethod: preSelectedPaymentMethod,
          })
        }
        showChevron
      />
    ));
  }, [sortedContacts, cache, navigate, t, preSelectedPaymentMethod]);

  const openMobileMoney = useCallback(() => {
    navigate.navigate('MobileMoneyCountryScreen', {
      preSelectedPaymentMethod,
    });
  }, [navigate, preSelectedPaymentMethod]);
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
        <TopBar fade title={t('constants.send')} />
        {sortedContacts.length ? (
          <CustomScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
          >
            <SectionHeader
              first
              title={t('screens.inAccount.sendList.contacts')}
            />
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
      <SendModal
        contentWidth={contentWidth}
        onPhonePress={openMobileMoney}
        preSelectedPaymentMethod={preSelectedPaymentMethod}
      />
    </CustomKeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  container: { flex: 1, ...CENTER },
  list: { paddingTop: FADE_TOP, paddingBottom: FADE },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
