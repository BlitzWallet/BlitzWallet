import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import displayCorrectDenomination from '../../../../../../functions/displayCorrectDenomination';
import { updateDidPayForSingleTx } from '../../../../../../functions/pos';
import { ThemeText } from '../../../../../../functions/CustomElements';
import CustomToggleSwitch from '../../../../../../functions/CustomElements/switch';
import ListRow from '../../../../../../functions/CustomElements/redesign/ListRow';
import { useTheme } from '../../../../../../../context-store/theme';

export const formatTipDate = timestamp =>
  new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

// One tip: amount · date, "Unpaid"/"Paid" and the switch that marks it by hand.
export default function TipsTXItem({ item, masterInfoObject, fiatStats, t }) {
  const { tokens } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  const handleTogglePayment = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const newPaymentStatus = item?.didPay ? 0 : 1;
      await updateDidPayForSingleTx(newPaymentStatus, item?.dbDateAdded);
    } catch (error) {
      console.error('Error updating payment status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const amount = displayCorrectDenomination({
    amount: item?.tipAmountSats,
    masterInfoObject,
    fiatStats,
  });
  const date = formatTipDate(item?.dbDateAdded);

  return (
    <ListRow
      title={amount}
      sub={date}
      titleLines={1}
      subLines={1}
      minHeight={64}
      titleStyle={styles.title}
      subStyle={styles.sub}
      trailing={
        <View style={styles.trailing}>
          <ThemeText
            styles={[styles.status, { color: tokens.muted }]}
            content={
              item?.didPay
                ? t('constants.paidLower')
                : t('constants.unpaidLower')
            }
          />
          <CustomToggleSwitch
            stateValue={!!item?.didPay}
            toggleSwitchFunction={handleTogglePayment}
            accessibilityLabel={t('settings.posPath.totalTipsScreen.markPaid', {
              amount,
              date,
            })}
            containerStyles={{ opacity: isLoading ? 0.5 : 1 }}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, lineHeight: 21 },
  sub: { fontSize: 13, lineHeight: 19 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: {
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
    textTransform: 'capitalize',
  },
});
