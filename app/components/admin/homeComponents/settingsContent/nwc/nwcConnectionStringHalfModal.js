import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FONT } from '../../../../../constants';
import { useTheme } from '../../../../../../context-store/theme';
import { useToast } from '../../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../../functions';
import ThemeText from '../../../../../functions/CustomElements/textTheme';
import CustomButton from '../../../../../functions/CustomElements/button';
import QrCard from '../../../../../functions/CustomElements/redesign/QrCard';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import Note from '../../../../../functions/CustomElements/redesign/Note';

// Full sheet height from the frame (grab + content + 34 bottom padding).
const SHEET_HEIGHT = 580;

export default function NWCConnectionStringHalfModal({
  data,
  accountName,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { showToast } = useToast();

  useEffect(() => {
    setContentHeight(SHEET_HEIGHT);
  }, []);

  const copy = () => copyToClipboard(data, showToast);

  return (
    <View style={styles.container}>
      <ThemeText
        content={t('settings.nwc.accountPage.viewSecretLabel')}
        styles={styles.title}
      />
      <ThemeText
        content={t('settings.nwc.connectionString.subtitle', {
          name: accountName,
        })}
        styles={[styles.subtitle, { color: tokens.muted }]}
      />
      <QrCard
        value={data}
        badge={<Disc icon={'Plug'} size={40} />}
        onPress={copy}
        accessibilityLabel={t('constants.copy')}
        style={styles.qrCard}
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
    paddingHorizontal: 20,
  },
  title: {
    marginTop: 20,
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
  qrCard: {
    marginTop: 16,
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
