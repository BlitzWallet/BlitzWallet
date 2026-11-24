import ListCard from './ListCard';
import ListRow from './ListRow';
import GetThemeColors from '../../../hooks/themeColors';
import { StyleSheet } from 'react-native';
import displayCorrectDenomination from '../../displayCorrectDenomination';
import formatBalanceAmount from '../../formatNumber';
import { CONTENT_KEYBOARD_OFFSET, SIZES } from '../../../constants';
import CurrencyIcon from './CurrencyIcon';

export default function PaymentMethod({
  determinePaymentMethod,
  handleSelectPaymentMethod,
  bitcoinBalance,
  dollarBalanceToken,
  masterInfoObject,
  fiatStats,
  uiState,
  t,
  showBitcoinCardOnly = false,
  containerStyles = {},
  hideBalance = false,
  isSend = true,
  title,
}) {
  const { tokens } = GetThemeColors();
  const isBitcoin =
    determinePaymentMethod === 'BTC' ||
    determinePaymentMethod === 'user-choice';

  const balance =
    determinePaymentMethod === 'BTC' || determinePaymentMethod === 'user-choice'
      ? displayCorrectDenomination({
          amount: bitcoinBalance,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'sats',
          },
          fiatStats,
        })
      : displayCorrectDenomination({
          amount: formatBalanceAmount(
            dollarBalanceToken,
            false,
            masterInfoObject,
          ),
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'fiat',
          },
          forceCurrency: 'USD',
          convertAmount: false,
          fiatStats,
        });
  return (
    <ListCard
      style={[
        styles.card,
        {
          marginTop: uiState === 'CHOOSE_METHOD' ? 30 : CONTENT_KEYBOARD_OFFSET,
        },
        containerStyles,
      ]}
    >
      <ListRow
        onPress={!showBitcoinCardOnly && handleSelectPaymentMethod}
        lead={<CurrencyIcon size={40} isBitcoin={isBitcoin} />}
        title={
          title ?? (isSend ? t('constants.payWith') : t('constants.receiveAs'))
        }
        titleStyle={{ ...styles.titeStyle, color: tokens.muted }}
        sub={
          !isSend
            ? determinePaymentMethod === 'BTC' ||
              determinePaymentMethod === 'user-choice'
              ? t('constants.bitcoin_upper')
              : t('constants.dollars_upper')
            : `${t(
                `constants.${
                  determinePaymentMethod === 'BTC' ||
                  determinePaymentMethod === 'user-choice'
                    ? 'bitcoin_upper'
                    : 'dollars_upper'
                }`,
              )}${' · ' + balance}`
        }
        subStyle={{ ...styles.subStyles, color: tokens.ink }}
        showChevron={!showBitcoinCardOnly}
      />
    </ListCard>
  );
}

const styles = StyleSheet.create({
  titeStyle: {
    fontSize: SIZES.smedium,
  },
  subStyles: {
    fontSize: SIZES.medium,
  },
});
