'use strict';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useTheme } from '../../../../../../context-store/theme';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

// SendLimits.dc.html "Swap rate updated": 88 white disc with a refresh glyph,
// the explanation under it. The title key names the disc for screen readers.
export default function SwapRatesChangedState() {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[styles.disc, { backgroundColor: tokens.surface }]}
        accessible
        accessibilityLabel={t(
          'wallet.sendPages.sendPaymentScreen.swapRatesChangedTitle',
        )}
      >
        <ThemeIcon redesign iconName={'RefreshCw'} size={36} />
      </View>
      <ThemeText
        variant="body"
        styles={[styles.body, { color: tokens.muted }]}
        content={t('wallet.sendPages.sendPaymentScreen.swapRatesChangedBody')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center' },
  disc: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { marginTop: 8, textAlign: 'center' },
});
