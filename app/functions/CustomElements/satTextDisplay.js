import { Platform, StyleSheet, View } from 'react-native';
import { useGlobalContextProvider } from '../../../context-store/context';
import {
  BITCOIN_SAT_TEXT,
  BITCOIN_SATS_ICON,
  CUSTOM_TOKEN_CURRENCY_OPTIONS,
  HIDDEN_BALANCE_CLOSE,
} from '../../constants';
import ThemeText from './textTheme';
import { formatCurrency } from '../formatCurrency';
import { useNodeContext } from '../../../context-store/nodeContext';
import formatBalanceAmount from '../formatNumber';
import formatTokensLabel from '../lrc20/formatTokensLabel';
import numberConverter from '../numberConverter';
import { useMemo } from 'react';
import truncateToTwoDecimals from '../truncateNumber';
import isFiatDustAmount from '../isFiatDustAmount';
import DustChevron from './redesign/DustChevron';

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
  autoAdjustFontSize = false,
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

  // Fiat above zero but under one cent reads "‹ 0.01" instead of "0.00".
  const isDust =
    !useCustomLabel &&
    isFiatDustAmount({
      amount: balance,
      denomination: localBalanceDenomination,
      fiatStats,
      convertAmount: !useBalance,
    });
  const customNumber = Number(balance);
  const isTokenDust =
    useCustomLabel &&
    !!showCustomCurrencyLabel &&
    customNumber > 0 &&
    customNumber < 0.01;
  const flatStyles = StyleSheet.flatten(styles);

  const formattedBalance = useMemo(
    () =>
      isDust
        ? formatBalanceAmount('0.01', false, masterInfoObject)
        : useBalance
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
      isDust,
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
  const dustChevron = (isDust || isTokenDust) && (
    <DustChevron
      key="dust"
      fontSize={flatStyles?.fontSize}
      fontFamily={flatStyles?.fontFamily}
      color={flatStyles?.color}
    />
  );

  const shouldShowAmount =
    neverHideBalance ||
    localBalanceDenomination === 'sats' ||
    localBalanceDenomination === 'fiat';

  const renderText = (content, extra = {}) => (
    <ThemeText
      CustomNumberOfLines={autoAdjustFontSize ? 1 : undefined}
      adjustsFontSizeToFit={autoAdjustFontSize}
      key={content}
      reversed={reversed}
      styles={{ includeFontPadding: false, ...styles, ...extra }}
      content={content}
    />
  );

  let children = [];

  if (!shouldShowAmount) {
    children = [
      frontText && renderText(frontText),
      renderText(HIDDEN_BALANCE_CLOSE),
      backText && renderText(backText),
    ];
  } else if (useCustomLabel) {
    if (showCustomCurrencyLabel) {
      children = [
        frontText && renderText(frontText),
        dustChevron,
        renderText(
          `${
            isSymbolInFront && showSymbol ? currencySymbol : ''
          }${formatBalanceAmount(
            truncateToTwoDecimals(isTokenDust ? 0.01 : balance),
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
      dustChevron,
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
    <View
      style={{
        ...localStyles.textContainer,
        // DustChevron is positioned from the text baseline.
        ...(dustChevron && { alignItems: 'baseline' }),
        ...containerStyles,
      }}
    >
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
