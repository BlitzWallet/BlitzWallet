import ListCard from './ListCard';
import ListRow from './ListRow';
import GetThemeColors from '../../../hooks/themeColors';
import { StyleSheet, View } from 'react-native';
import displayCorrectDenomination from '../../displayCorrectDenomination';
import formatBalanceAmount from '../../formatNumber';
import {
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  SIZES,
} from '../../../constants';
import ThemeImage from '../themeImage';
import { useGlobalThemeContext } from '../../../../context-store/theme';

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
}) {
  const { mode } = useGlobalThemeContext();
  const { tokens } = GetThemeColors();
  const icon =
    determinePaymentMethod === 'BTC' || determinePaymentMethod === 'user-choice'
      ? 'bitcoinIcon'
      : 'dollarIcon';

  const iconBackgroundColor =
    determinePaymentMethod === 'BTC' || determinePaymentMethod === 'user-choice'
      ? 'bitcoinOrange'
      : 'dollarGreen';

  const showHiddenBalance =
    masterInfoObject.userBalanceDenomination === 'hidden';

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
        lead={
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor:
                  mode === 'lightsOut'
                    ? tokens.ground
                    : COLORS[iconBackgroundColor],
              },
            ]}
          >
            <ThemeImage
              styles={{ width: 20, height: 20 }}
              lightModeIcon={ICONS[icon]}
              darkModeIcon={ICONS[icon]}
              lightsOutIcon={ICONS[icon]}
            />
          </View>
        }
        title={isSend ? t('constants.payWith') : t('constants.receiveAs')}
        titleStyle={{ ...styles.titeStyle, color: tokens.muted }}
        sub={`${t(
          uiState === 'CONTACT_REQUEST' || hideBalance
            ? `constants.${
                determinePaymentMethod === 'BTC' ||
                determinePaymentMethod === 'user-choice'
                  ? 'bitcoin_upper'
                  : 'dollars_upper'
              }`
            : `constants.${
                determinePaymentMethod === 'BTC' ||
                determinePaymentMethod === 'user-choice'
                  ? 'sat'
                  : 'usd'
              }_balance`,
        )}${showHiddenBalance ? '' : ' · ' + balance}`}
        subStyle={{ ...styles.subStyles, color: tokens.ink }}
        showChevron={true}
      />
    </ListCard>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titeStyle: {
    fontSize: SIZES.smedium,
  },
  subStyles: {
    fontSize: SIZES.medium,
  },
});
