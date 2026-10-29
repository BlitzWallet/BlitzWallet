import { StyleSheet, View, useWindowDimensions } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { ThemeText } from '../../../../functions/CustomElements';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../../context-store/theme';
import { SheetTitle } from '../savings/savingsSheetParts';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import ContactAvatar from './internalComponents/contactAvatar';

const DAY_MS = 24 * 60 * 60 * 1000;

const dayStart = time => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

// "Today" / "Yesterday" / "Oct 2", same titles as the contact history.
const dayLabel = (timestamp, t) => {
  const start = dayStart(timestamp);
  const todayStart = dayStart(Date.now());
  if (start === todayStart) return t('constants.today');
  if (start === todayStart - DAY_MS) return t('constants.yesterday');
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
};

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
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
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

  const time = new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View style={[styles.container, { width: contentWidth }]}>
      <SheetTitle first title={t('contacts.expandedMessageHalfModal.title')} />
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
          sub={`${dayLabel(timestamp, t)} · ${time}`}
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
  container: { flex: 1, ...CENTER },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  scroll: { marginTop: 16, flexGrow: 0 },
  listCard: { marginVertical: 10 },
  card: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  message: { lineHeight: 24 },
});
