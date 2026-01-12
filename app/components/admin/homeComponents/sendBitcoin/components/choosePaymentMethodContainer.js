import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import { CENTER, ICONS } from '../../../../../constants';
import GetThemeColors from '../../../../../hooks/themeColors';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { formatBalanceAmount } from '../../../../../functions';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function ChoosePaymentMethod({
  theme,
  darkModeType,
  determinePaymentMethod,
  handleSelectPaymentMethod,
  bitcoinBalance,
  dollarBalanceToken,
  masterInfoObject,
  fiatStats,
  uiState,
  t,
  containerStyles = {},
}) {
  const { backgroundColor } = GetThemeColors();
  const icon =
    determinePaymentMethod === 'BTC' || determinePaymentMethod === 'user-choice'
      ? 'bitcoinIcon'
      : 'dollarIcon';

  const iconBackgroundColor =
    determinePaymentMethod === 'BTC' || determinePaymentMethod === 'user-choice'
      ? 'bitcoinOrange'
      : 'dollarGreen';

  const balance =
    determinePaymentMethod === 'BTC' || determinePaymentMethod === 'user-choice'
      ? displayCorrectDenomination({
          amount: bitcoinBalance,
          masterInfoObject,
          fiatStats,
        })
      : displayCorrectDenomination({
          amount: formatBalanceAmount(
            Number(dollarBalanceToken).toFixed(2),
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
    <View
      style={[
        styles.paymentMethodContainer,
        containerStyles,
        { marginTop: uiState === 'CHOOSE_METHOD' ? 30 : 5 },
      ]}
    >
      {/* <ThemeText styles={styles.header} content={'Pay with'} /> */}
      <TouchableOpacity
        onPress={() => handleSelectPaymentMethod(false)}
        style={styles.selectorContainer}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                theme && darkModeType
                  ? backgroundColor
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
        <View style={styles.textContainer}>
          <ThemeText
            styles={styles.balanceTitle}
            content={t(
              `constants.${
                determinePaymentMethod === 'BTC' ||
                determinePaymentMethod === 'user-choice'
                  ? 'sat'
                  : 'usd'
              }_balance`,
            )}
          />
          <ThemeText styles={styles.amountText} content={`${balance}`} />
        </View>
        <ThemeIcon
          colorOverride={
            theme && darkModeType ? COLORS.lightModeText : COLORS.primary
          }
          size={20}
          iconName={'ChevronDown'}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  paymentMethodContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  header: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
    marginBottom: 5,
  },
  selectorContainer: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.darkModeText,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    width: '100%',
    flexShrink: 1,
    marginLeft: 15,
  },
  balanceTitle: {
    includeFontPadding: false,
    color: COLORS.lightModeText,
  },
  amountText: {
    opacity: 0.7,
    includeFontPadding: false,
    color: COLORS.lightModeText,
  },
});
