import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { openInbox } from 'react-native-email-link';
import { useToast } from '../../../../context-store/toastManager';
import { copyToClipboard } from '../../../functions';
import Disc from '../../../functions/CustomElements/redesign/Disc';
import ListCard from '../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../functions/CustomElements/redesign/ListRow';

const SUPPORT_EMAIL = 'support@blitzwalletapp.com';
const SHEET_CHROME_HEIGHT = 49;

export default function ContactUsHalfModal({
  handleBackPressFunction,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const copyEmail = () => {
    copyToClipboard(SUPPORT_EMAIL, showToast);
    handleBackPressFunction?.();
  };

  const openEmailInbox = async () => {
    try {
      await openInbox();
    } catch (err) {
      copyToClipboard(SUPPORT_EMAIL, showToast);
    }
    handleBackPressFunction?.();
  };

  return (
    <View
      style={styles.container}
      onLayout={e =>
        setContentHeight?.(
          Math.round(e.nativeEvent.layout.height) + SHEET_CHROME_HEIGHT,
        )
      }
    >
      <ListCard tone="flush" dividerInset={68}>
        <ListRow
          title={t('constants.copyEmail')}
          minHeight={64}
          lead={<Disc icon="Copy" size={40} />}
          trailing="chevron"
          onPress={copyEmail}
        />
        <ListRow
          title={t('constants.openInbox')}
          minHeight={64}
          lead={<Disc icon="Inbox" size={40} />}
          trailing="chevron"
          onPress={openEmailInbox}
        />
      </ListCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
