import {StyleSheet, View} from 'react-native';
import {useGlobalContextProvider} from '../../../context-store/context';
import {
  BITCOIN_SAT_TEXT,
  BITCOIN_SATS_ICON,
  HIDDEN_BALANCE_TEXT,
  TOKEN_TICKER_MAX_LENGTH,
} from '../../constants';
import ThemeText from './textTheme';
import {formatCurrency} from '../formatCurrency';
import {useNodeContext} from '../../../context-store/nodeContext';
import formatBalanceAmount from '../formatNumber';
import numberConverter from '../numberConverter';
import {useMemo} from 'react';

export default function FormattedSatText({
  balance = 0,
  styles,
  reversed,
  frontText,
  containerStyles,
  isFailedPayment,
  neverHideBalance,
  globalBalanceDenomination,
  backText,
  useBalance,
  useCustomLabel = false,
  customLabel = '',
}) {
  const {masterInfoObject} = useGlobalContextProvider();
  const {fiatStats} = useNodeContext();
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
          ),
    [balance, useBalance, localBalanceDenomination, fiatStats],
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

  if (useCustomLabel) {
    return (
      <View
        style={{
          ...localStyles.textContainer,
          ...containerStyles,
        }}>
        {frontText && (
          <ThemeText
            styles={{includeFontPadding: false, marginLeft: 'auto', ...styles}}
            content={`${frontText}`}
          />
        )}
        <ThemeText
          reversed={reversed}
          content={`${formattedBalance}`}
          styles={{
            includeFontPadding: false,
            marginLeft: frontText ? 0 : 'auto',
            ...styles,
          }}
        />

        <ThemeText
          CustomNumberOfLines={1}
          styles={{
            includeFontPadding: false,
            flexShrink: 1,
            ...styles,
          }}
          content={` ${customLabel
            ?.toUpperCase()
            ?.slice(0, TOKEN_TICKER_MAX_LENGTH)}`}
        />

        {backText && (
          <ThemeText
            styles={{includeFontPadding: false, ...styles}}
            content={`${backText}`}
          />
        )}
      </View>
    );
  }

  // Hidding balance format
  if (!shouldShowAmount) {
    return (
      <View
        style={{
          ...localStyles.textContainer,
          ...containerStyles,
        }}>
        {frontText && (
          <ThemeText
            styles={{includeFontPadding: false, ...styles}}
            content={`${frontText}`}
          />
        )}
        <ThemeText
          reversed={reversed}
          content={HIDDEN_BALANCE_TEXT}
          styles={{includeFontPadding: false, ...styles}}
        />
        {backText && (
          <ThemeText
            styles={{includeFontPadding: false, ...styles}}
            content={`${backText}`}
          />
        )}
      </View>
    );
  }
  // Bitcoin sats formatting
  if (showSats) {
    return (
      <View
        style={{
          ...localStyles.textContainer,
          ...containerStyles,
        }}>
        {frontText && (
          <ThemeText
            styles={{includeFontPadding: false, ...styles}}
            content={`${frontText}`}
          />
        )}
        {showSymbol && (
          <ThemeText
            styles={{includeFontPadding: false, ...styles}}
            content={BITCOIN_SATS_ICON}
          />
        )}
        <ThemeText
          reversed={reversed}
          content={`${formattedBalance}`}
          styles={{includeFontPadding: false, ...styles}}
        />
        {!showSymbol && (
          <ThemeText
            styles={{includeFontPadding: false, ...styles}}
            content={` ${BITCOIN_SAT_TEXT}`}
          />
        )}

        {backText && (
          <ThemeText
            styles={{includeFontPadding: false, ...styles}}
            content={`${backText}`}
          />
        )}
      </View>
    );
  }

  // Fiat format
  return (
    <View
      style={{
        ...localStyles.textContainer,
        ...containerStyles,
      }}>
      {frontText && (
        <ThemeText
          styles={{includeFontPadding: false, ...styles}}
          content={`${frontText}`}
        />
      )}
      {isSymbolInFront && showSymbol && (
        <ThemeText
          styles={{includeFontPadding: false, ...styles}}
          content={currencySymbol}
        />
      )}
      <ThemeText
        reversed={reversed}
        content={`${currencyOptions[1]}`}
        styles={{includeFontPadding: false, ...styles}}
      />
      {!isSymbolInFront && showSymbol && (
        <ThemeText
          styles={{includeFontPadding: false, ...styles}}
          content={currencySymbol}
        />
      )}
      {!showSymbol && (
        <ThemeText
          styles={{includeFontPadding: false, ...styles}}
          content={` ${currencyText}`}
        />
      )}
      {backText && (
        <ThemeText
          styles={{includeFontPadding: false, ...styles}}
          content={`${backText}`}
        />
      )}
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
