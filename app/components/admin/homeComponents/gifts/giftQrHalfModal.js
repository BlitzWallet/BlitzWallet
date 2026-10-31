import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FONT } from '../../../../constants';
import { useTheme } from '../../../../../context-store/theme';
import ThemeText from '../../../../functions/CustomElements/textTheme';
import QrCard from '../../../../functions/CustomElements/redesign/QrCard';
import Disc from '../../../../functions/CustomElements/redesign/Disc';

const SHEET_HEIGHT = 500;

export default function GiftQrHalfModal({ claimURL, title, setContentHeight }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  useEffect(() => {
    setContentHeight(SHEET_HEIGHT);
  }, []);

  return (
    <View style={styles.container}>
      <ThemeText
        content={t('screens.inAccount.giftPages.giftConfirmation.scanToClaim')}
        styles={styles.title}
      />
      {!!title && (
        <ThemeText
          content={title}
          styles={[styles.sub, { color: tokens.muted }]}
        />
      )}
      <QrCard
        value={claimURL}
        badge={<Disc icon={'Gift'} tone="primary" size={40} />}
        style={styles.qrCard}
      />
      <ThemeText
        content={t('screens.inAccount.giftPages.giftConfirmation.scanWarning')}
        styles={[styles.warning, { color: tokens.muted }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: {
    marginTop: 20,
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
  },
  sub: {
    marginTop: 4,
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  qrCard: { marginTop: 20, alignSelf: 'center' },
  warning: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
});
