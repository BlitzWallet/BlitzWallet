import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CONTENT_KEYBOARD_OFFSET } from '../../../../constants';
import QrCard from '../../../../functions/CustomElements/redesign/QrCard';
import CustomButton from '../../../../functions/CustomElements/button';
import Note from '../../../../functions/CustomElements/redesign/Note';
import { useToast } from '../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../functions';

export default function GiftQrHalfModal({ claimURL, setContentHeight }) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  useEffect(() => {
    setContentHeight(500);
  }, []);

  const handleClick = () => copyToClipboard(claimURL, showToast);

  return (
    <View style={styles.container}>
      <View style={styles.qrCard}>
        <QrCard onPress={handleClick} value={claimURL} />
      </View>

      <Note
        text={t('screens.inAccount.giftPages.giftConfirmation.scanWarning')}
        tone="warn"
      />
      <CustomButton
        actionFunction={handleClick}
        buttonStyles={styles.button}
        size={'regular'}
        textContent={t('constants.copy')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  qrCard: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  button: { marginTop: CONTENT_KEYBOARD_OFFSET },
});
