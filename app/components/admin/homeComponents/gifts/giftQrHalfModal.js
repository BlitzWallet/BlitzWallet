import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FONT } from '../../../../constants';
import { useTheme } from '../../../../../context-store/theme';
import ThemeText from '../../../../functions/CustomElements/textTheme';
import SheetHeader from '../../../../functions/CustomElements/redesign/SheetHeader';
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
      <SheetHeader
        first
        title={t('screens.inAccount.giftPages.giftConfirmation.scanToClaim')}
        sub={title}
      />
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
  container: { flex: 1 },
  qrCard: { alignSelf: 'center' },
  warning: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
});
