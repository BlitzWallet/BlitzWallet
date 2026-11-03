import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../../functions';
import SheetHeader from '../../../../../functions/CustomElements/redesign/SheetHeader';
import CustomButton from '../../../../../functions/CustomElements/button';
import QrCard from '../../../../../functions/CustomElements/redesign/QrCard';
import Note from '../../../../../functions/CustomElements/redesign/Note';

// Full sheet height from the frame (grab + content + 34 bottom padding).
const SHEET_HEIGHT = 580;

export default function NWCConnectionStringHalfModal({
  data,
  accountName,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  useEffect(() => {
    setContentHeight(SHEET_HEIGHT);
  }, []);

  const copy = () => copyToClipboard(data, showToast);

  return (
    <View style={styles.container}>
      <SheetHeader
        first
        title={t('settings.nwc.accountPage.viewSecretLabel')}
        sub={t('settings.nwc.connectionString.subtitle', {
          name: accountName,
        })}
      />
      <QrCard
        value={data}
        onPress={copy}
        accessibilityLabel={t('constants.copy')}
      />
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
