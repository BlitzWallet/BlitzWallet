import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { ThemeText } from '../../../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../../context-store/theme';
import SheetHeader from '../../../../functions/CustomElements/redesign/SheetHeader';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import ContactAvatar from './internalComponents/contactAvatar';
import formatDate from '../../../../functions/formatDate';

// "Today" / "Yesterday" / "Oct 2", same titles as the contact history.
const dayLabel = timestamp => formatDate(timestamp, 'day');

// "Full message" sheet: title, the payment it belongs to (avatar, "Alex sent
// you $25.00", "Today · 12:40 PM"), then the note in a grey bubble. Long notes
// scroll inside the bubble.
export default function ExpandedMessageHalfModal({
  message,
  selectedContact,
  txParsed,
  amount,
  timestamp,
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const name = selectedContact?.name || selectedContact?.uniqueName;

  const title = txParsed?.isRequest
    ? t('contacts.internalComponents.contactsTransactions.requestedAmount', {
        name,
        amount,
      })
    : `${t(
        txParsed?.didSend
          ? 'contacts.internalComponents.contactsTransactions.youPaid'
          : 'contacts.internalComponents.contactsTransactions.theySentYou',
        { name },
      )} ${amount}`;

  const time = formatDate(timestamp, 'time');

  return (
    <View style={styles.container}>
      <SheetHeader first title={t('contacts.expandedMessageHalfModal.title')} />
      <View style={styles.listCard}>
        <ListRow
          minHeight={40}
          paddingVertical={0}
          titleStyle={styles.rowTitle}
          titleLines={2}
          lead={
            <ContactAvatar
              name={name}
              seed={selectedContact?.uuid}
              size={40}
              fontSize={14}
            />
          }
          title={title}
          sub={`${dayLabel(timestamp)} · ${time}`}
        />
      </View>
      <CustomScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.card,
          { backgroundColor: tokens.ground },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ThemeText
          variant="body"
          styles={styles.message}
          content={
            message || t('contacts.expandedMessageHalfModal.noDescription')
          }
        />
      </CustomScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  scroll: { marginTop: 16, flexGrow: 0 },
  listCard: { marginBottom: 10 },
  card: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  message: { lineHeight: 24 },
});
