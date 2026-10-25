import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { openComposer, openInbox } from 'react-native-email-link';
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
  emailSubject,
  emailBody,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const copyEmail = () => {
    copyToClipboard(SUPPORT_EMAIL, showToast);
    handleBackPressFunction?.();
  };

  // With a body (failed-payment support) the email opens pre-filled.
  const openEmailInbox = async () => {
    try {
      if (emailBody) {
        await openComposer({
          to: SUPPORT_EMAIL,
          subject: emailSubject,
          body: emailBody,
        });
      } else {
        await openInbox();
      }
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
          title={t(
            emailBody ? 'constants.emailSupport' : 'constants.openInbox',
          )}
          minHeight={64}
          lead={<Disc icon={emailBody ? 'Mail' : 'Inbox'} size={40} />}
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
