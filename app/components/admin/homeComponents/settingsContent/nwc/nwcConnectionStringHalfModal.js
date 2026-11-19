import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../../functions';
import CustomButton from '../../../../../functions/CustomElements/button';
import QrCard from '../../../../../functions/CustomElements/redesign/QrCard';
import Note from '../../../../../functions/CustomElements/redesign/Note';

export default function NWCConnectionStringHalfModal({
  data,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  useEffect(() => {
    setContentHeight(500);
  }, []);

  const copy = () => copyToClipboard(data, showToast);

  return (
    <View style={styles.container}>
      <View style={styles.qr}>
        <QrCard
          value={data}
          onPress={copy}
          accessibilityLabel={t('constants.copy')}
        />
      </View>
      <View style={styles.footer}>
        <View style={styles.note}>
          <Note
            tone="warn"
            text={t('settings.nwc.connectionString.warning')}
            textStyle={styles.noteText}
          />
        </View>
        <CustomButton
          size="regular"
          tone="primary"
          actionFunction={copy}
          textContent={t('constants.copy')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  qr: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: 'auto',
    gap: 16,
  },
  note: {
    paddingHorizontal: 4,
  },
  noteText: {
    lineHeight: 20,
    paddingTop: 5,
  },
});
