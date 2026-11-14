import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useTheme } from '../../../../../context-store/theme';
import { FONT } from '../../../../constants';

// Shared pieces of the swap sheet steps (Swap.dc.html).

// Back disc · 15/400 label, under the grab handle.
export function SwapBackRow({ onBack, title }) {
  return (
    <View style={styles.backRow}>
      <IconButton
        icon="ArrowLeft"
        label="constants.back"
        tone="disc"
        onPress={onBack}
      />
      {!!title && (
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.backTitle}
          content={title}
        />
      )}
    </View>
  );
}

export function SwapDisclaimer() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <ThemeText
      styles={[styles.disclaimer, { color: tokens.muted }]}
      content={t('screens.inAccount.swapsPage.swapDisclaimer')}
    />
  );
}

// Sats and USD strings as the swap screens show them.
export function useSwapFormatters() {
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const formatSats = amount =>
    displayCorrectDenomination({
      amount,
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: 'sats',
      },
      fiatStats,
    });
  const formatUsd = amount =>
    displayCorrectDenomination({
      amount,
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: 'fiat',
      },
      fiatStats,
      forceCurrency: 'USD',
      convertAmount: false,
    });
  return { formatSats, formatUsd, masterInfoObject, fiatStats };
}

const styles = StyleSheet.create({
  backRow: {
    minHeight: 44,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backTitle: {
    flexShrink: 1,
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  disclaimer: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
