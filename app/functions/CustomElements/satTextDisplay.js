import { Platform, StyleSheet, View } from 'react-native';
import { useGlobalContextProvider } from '../../../context-store/context';
import {
  BITCOIN_SAT_TEXT,
  BITCOIN_SATS_ICON,
  HIDDEN_BALANCE_TEXT,
  TOKEN_TICKER_MAX_LENGTH,
} from '../../constants';
import ThemeText from './textTheme';
import { formatCurrency } from '../formatCurrency';
import { useNodeContext } from '../../../context-store/nodeContext';
import formatBalanceAmount from '../formatNumber';
import numberConverter from '../numberConverter';
import { useMemo } from 'react';

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
}) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();

  const localBalanceDenomination =
    globalBalanceDenomination || masterInfoObject.userBalanceDenomination;
  const currencyText = fiatStats.coin || 'USD';

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
          ),
    [
      balance,
      useBalance,
      localBalanceDenomination,
      fiatStats,
      useMillionDenomination,
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

  let children = [];

  if (!shouldShowAmount) {
    children = [
      frontText && renderText(frontText),
      renderText(HIDDEN_BALANCE_TEXT),
      backText && renderText(backText),
    ];
  } else if (useCustomLabel) {
    children = [
      frontText && renderText(frontText, { marginLeft: 'auto' }),
      renderText(formatBalanceAmount(balance, useMillionDenomination), {
        marginLeft: frontText ? 0 : 'auto',
      }),
      renderText(
        ` ${customLabel?.toUpperCase()?.slice(0, TOKEN_TICKER_MAX_LENGTH)}`,
        { flexShrink: 1 },
      ),
      backText && renderText(backText),
    ];
  } else if (showSats) {
    children = [
      frontText && renderText(frontText),
      renderText(
        `${showSymbol ? BITCOIN_SATS_ICON : ''}${
          Platform.OS === 'android'
            ? `\u200A\u200A\u200A${formattedBalance}\u200A\u200A\u200A`
            : formattedBalance
        }${
          !showSymbol
            ? `${Platform.OS == 'android' ? '' : ' '}` + BITCOIN_SAT_TEXT
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
  },
});
