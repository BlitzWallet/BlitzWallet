import { StyleSheet, View } from 'react-native';
import { formatTxDate, fromMicros } from './utils';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { ThemeText } from '../../../../functions/CustomElements';
import { COLORS, SIZES } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';

const ICON_BY_TYPE = {
  interest: 'Sparkles',
  deposit: 'ArrowDown',
  withdrawal: 'ArrowUp',
};

export default function SavingsTransactionComponenet({ item, isLastIndex }) {
  const { backgroundOffset } = GetThemeColors();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const amount = fromMicros(item.amountMicros);
  const isPositive = amount >= 0;
  return (
    <View
      style={[
        styles.activityRow,
        { borderBottomWidth: isLastIndex ? 0 : StyleSheet.hairlineWidth },
      ]}
    >
      <View style={styles.activityLeft}>
        <View
          style={[
            styles.activityIconCircle,
            { backgroundColor: backgroundOffset },
          ]}
        >
          <ThemeIcon iconName={ICON_BY_TYPE[item.type]} size={16} />
        </View>
        <View>
          <ThemeText styles={styles.activityTitle} content={item.description} />
          <ThemeText
            styles={styles.activityDate}
            content={formatTxDate(item.createdAt)}
          />
        </View>
      </View>
      <ThemeText
        styles={[styles.activityAmount]}
        content={`${isPositive ? '+' : ''}${displayCorrectDenomination({
          amount: amount,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'fiat',
          },
          fiatStats,
          forceCurrency: 'USD',
          convertAmount: false,
        })}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  activityRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomColor: COLORS.gray2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  activityDate: {
    fontSize: SIZES.xSmall,
    opacity: 0.6,
    includeFontPadding: false,
  },
  activityAmount: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
});
