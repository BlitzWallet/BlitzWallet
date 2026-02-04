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
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { Image as ExpoImage } from 'expo-image';
import formatTokensNumber from '../../../../../functions/lrc20/formatTokensBalance';

export default function ChooseLRC20TokenContainer({
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
  seletctedToken,
  selectedLRC20Asset,
  containerStyles = {},
}) {
  const { tokensImageCache } = useSparkWallet();
  const { backgroundColor } = GetThemeColors();

  const imageUri = tokensImageCache[selectedLRC20Asset];
  const balance =
    selectedLRC20Asset === 'Bitcoin'
      ? displayCorrectDenomination({
          amount: bitcoinBalance,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'sats',
          },
          fiatStats,
          convertAmount: false,
        })
      : displayCorrectDenomination({
          amount: formatTokensNumber(
            seletctedToken?.balance,
            seletctedToken?.tokenMetadata?.decimals,
          ),
          masterInfoObject,
          useCustomLabel: true,
          customLabel: seletctedToken?.tokenMetadata?.tokenTicker,
          fiatStats,
        });
  console.log(selectedLRC20Asset, seletctedToken, 'tokens', imageUri);
  return (
    <View style={[styles.paymentMethodContainer, containerStyles]}>
      {/* <ThemeText styles={styles.header} content={'Pay with'} /> */}
      <TouchableOpacity
        onPress={handleSelectPaymentMethod}
        style={styles.selectorContainer}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                theme && darkModeType
                  ? backgroundColor
                  : selectedLRC20Asset === 'Bitcoin'
                  ? COLORS.bitcoinOrange
                  : COLORS.primary,
            },
          ]}
        >
          {selectedLRC20Asset === 'Bitcoin' ? (
            <View>
              <ThemeImage
                styles={{
                  width: 15,
                  height: 20,
                }}
                source={ICONS.bitcoinIcon}
                disableTint={true}
              />
            </View>
          ) : imageUri ? (
            <ExpoImage
              source={{ uri: imageUri }}
              style={styles.tokenImage}
              contentFit="contain"
              priority="normal"
              transition={100}
            />
          ) : (
            <ThemeIcon
              colorOverride={COLORS.darkModeText}
              size={20}
              iconName={'Coins'}
            />
          )}
        </View>
        <View style={styles.textContainer}>
          <ThemeText
            styles={styles.balanceTitle}
            content={
              (seletctedToken?.tokenMetadata?.tokenTicker || 'Bitcoin') +
              ' ' +
              t(`constants.balance`)
            }
          />
          {uiState !== 'CONTACT_REQUEST' && (
            <ThemeText styles={styles.amountText} content={`${balance}`} />
          )}
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
    marginTop: 5,
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
    overflow: 'hidden',
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
  tokenImage: {
    width: 40,
    height: 40,
    flex: 1,
  },
});
