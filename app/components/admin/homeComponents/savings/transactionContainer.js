import { StyleSheet } from 'react-native';
import { formatTxDate, fromMicros } from './utils';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';

const ICON_BY_TYPE = {
  interest: 'Sparkles',
  deposit: 'ArrowDown',
  withdrawal: 'ArrowUp',
  bitcoinWithdrawal: 'ArrowUp',
};

export default function SavingsTransactionComponenet({ item }) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const amount =
    fromMicros(item.amountMicros) *
    (item.type === 'bitcoinWithdrawal' ? -1 : 1);
  const isPositive = amount >= 0;

  const showSats =
    item.type === 'interest' || item.type === 'bitcoinWithdrawal';

  return (
    <ListRow
      lead={<Disc icon={ICON_BY_TYPE[item.type]} size={40} />}
      title={item.description}
      titleStyle={styles.title}
      sub={formatTxDate(item.createdAt)}
      subLines={1}
      minHeight={64}
      trailing={
        <ThemeText
          styles={[styles.activityAmount]}
          content={`${isPositive ? '+' : '−'}${displayCorrectDenomination({
            amount: showSats ? Math.abs(amount) : Math.abs(amount).toFixed(2),
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: showSats ? 'sats' : 'fiat',
            },
            fiatStats,
            forceCurrency: showSats ? null : 'USD',
            convertAmount: showSats ? true : false,
          })}`}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 15,
    lineHeight: 21,
  },
  activityAmount: {
    fontSize: 15,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
});
