import { Platform, StyleSheet, View } from 'react-native';
import { useGlobalContextProvider } from '../../../context-store/context';
import {
  BITCOIN_SAT_TEXT,
  BITCOIN_SATS_ICON,
  CUSTOM_TOKEN_CURRENCY_OPTIONS,
  FONT,
  HIDDEN_BALANCE_TEXT,
  SIZES,
} from '../../constants';
import ThemeText from './textTheme';
import { formatCurrency } from '../formatCurrency';
import { useNodeContext } from '../../../context-store/nodeContext';
import formatBalanceAmount from '../formatNumber';
import formatTokensLabel from '../lrc20/formatTokensLabel';
import numberConverter from '../numberConverter';
import { useMemo } from 'react';
import truncateToTwoDecimals from '../truncateNumber';

export default function FormattedSatText({
  balance = 0,
  styles,
  reversed,
  frontText,
  containerStyles,
  neverHideBalance,
  globalBalanceDenomination,
  backText,
  useBalance,
  useCustomLabel = false,
  customLabel = '',
  useMillionDenomination = false,
  useSpaces = true,
  useSizing = false,
  forceCurrency = null,
  forceFiatStats = null,
}) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats: globalFiatStats } = useNodeContext();

  const showCustomCurrencyLabel = CUSTOM_TOKEN_CURRENCY_OPTIONS.find(
    item => item.token === customLabel,
  );

  const fiatStats = forceFiatStats || globalFiatStats;
  const localBalanceDenomination =
    globalBalanceDenomination || masterInfoObject.userBalanceDenomination;
  const currencyText = forceCurrency
    ? forceCurrency
    : showCustomCurrencyLabel
    ? showCustomCurrencyLabel.currency
    : masterInfoObject.fiatCurrency || 'USD';

  const formattedBalance = useMemo(
    () =>
      useBalance
        ? balance
        : formatBalanceAmount(
            numberConverter(
              balance,
              localBalanceDenomination,
              localBalanceDenomination === 'fiat' ? 2 : 0,
              fiatStats,
            ),
            useMillionDenomination,
            masterInfoObject,
          ),
    [
      balance,
      useBalance,
      localBalanceDenomination,
      fiatStats,
      useMillionDenomination,
      masterInfoObject.thousandsSeperator,
      masterInfoObject.userSelectedLanguage,
    ],
  );

  const currencyOptions = useMemo(
    () =>
      formatCurrency({
        amount: formattedBalance,
        code: currencyText,
      }),
    [formattedBalance, currencyText],
  );

  const isSymbolInFront = currencyOptions[3];
  const currencySymbol = currencyOptions[2];
  const showSymbol = masterInfoObject.satDisplay === 'symbol';
  const showSats =
    localBalanceDenomination === 'sats' ||
    localBalanceDenomination === 'hidden';

  const shouldShowAmount =
    neverHideBalance ||
    localBalanceDenomination === 'sats' ||
    localBalanceDenomination === 'fiat';

  const renderText = (content, extra = {}) => (
    <ThemeText
      key={content}
      reversed={reversed}
      styles={{ includeFontPadding: false, ...styles, ...extra }}
      content={content}
    />
  );
  const hiddenText = (content, key, extra = {}) => (
    <ThemeText
      key={key}
      reversed={reversed}
      styles={{ includeFontPadding: false, ...styles, ...extra }}
      content={content}
    />
  );

  let children = [];

  if (!shouldShowAmount) {
    children = [
      frontText && renderText(frontText),
      hiddenText(HIDDEN_BALANCE_TEXT, 1, {
        fontSize: styles?.fontSize
          ? styles.fontSize * (useSizing ? 0.65 : 1)
          : SIZES.xSmall * (useSizing ? 0.65 : 1),
        fontFamily: FONT.Asterisk,
        marginHorizontal: 2,
      }),
      hiddenText(HIDDEN_BALANCE_TEXT, 2, {
        fontSize: styles?.fontSize
          ? styles.fontSize * (useSizing ? 0.75 : 1)
          : SIZES.xSmall * (useSizing ? 0.75 : 1),
        fontFamily: FONT.Asterisk,
        marginHorizontal: 2,
      }),
      hiddenText(HIDDEN_BALANCE_TEXT, 3, {
        fontSize: styles?.fontSize
          ? styles.fontSize * (useSizing ? 0.85 : 1)
          : SIZES.xSmall * (useSizing ? 0.85 : 1),
        fontFamily: FONT.Asterisk,
        marginHorizontal: 2,
      }),
      hiddenText(HIDDEN_BALANCE_TEXT, 4, {
        fontSize: styles?.fontSize
          ? styles.fontSize * (useSizing ? 0.75 : 1)
          : SIZES.xSmall * (useSizing ? 0.75 : 1),
        fontFamily: FONT.Asterisk,
        marginHorizontal: 2,
      }),
      hiddenText(HIDDEN_BALANCE_TEXT, 5, {
        fontSize: styles?.fontSize
          ? styles.fontSize * (useSizing ? 0.65 : 1)
          : SIZES.xSmall * (useSizing ? 0.65 : 1),
        fontFamily: FONT.Asterisk,
        marginHorizontal: 2,
      }),
      backText && renderText(backText),
    ];
  } else if (useCustomLabel) {
    if (showCustomCurrencyLabel) {
      children = [
        frontText && renderText(frontText),
        renderText(
          `${
            isSymbolInFront && showSymbol ? currencySymbol : ''
          }${formatBalanceAmount(
            truncateToTwoDecimals(balance),
            true,
            masterInfoObject,
          )}${!isSymbolInFront && showSymbol ? currencySymbol : ''}${
            !showSymbol ? ' ' + currencyText : ''
          }`,
        ),
        backText && renderText(backText),
      ];
    } else {
      children = [
        frontText && renderText(frontText, { marginLeft: 'auto' }),
        renderText(
          formatBalanceAmount(
            balance,
            useMillionDenomination,
            masterInfoObject,
          ),
          {
            marginLeft: frontText ? 0 : 'auto',
          },
        ),
        renderText(` ${formatTokensLabel(customLabel)}`, { flexShrink: 1 }),
        backText && renderText(backText),
      ];
    }
  } else if (showSats) {
    children = [
      frontText && renderText(frontText),
      renderText(
        `${showSymbol ? BITCOIN_SATS_ICON : ''}${formattedBalance}${
          !showSymbol
            ? `${Platform.OS == 'android' ? ' ' : ' '}` + BITCOIN_SAT_TEXT
            : ''
        }`,
      ),
      backText && renderText(backText),
    ];
  } else {
    // Fiat
    children = [
      frontText && renderText(frontText),
      renderText(
        `${isSymbolInFront && showSymbol ? currencySymbol : ''}${
          currencyOptions[1]
        }${!isSymbolInFront && showSymbol ? currencySymbol : ''}${
          !showSymbol ? ' ' + currencyText : ''
        }`,
      ),
      backText && renderText(backText),
    ];
  }

  return (
    <View style={{ ...localStyles.textContainer, ...containerStyles }}>
      {children.filter(Boolean)}
    </View>
  );
}

const localStyles = StyleSheet.create({
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    paddingHorizontal: 5,
  },
});
