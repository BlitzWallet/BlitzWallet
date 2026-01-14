import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BITCOIN_SAT_TEXT,
  BITCOIN_SATS_ICON,
  CENTER,
  FONT,
} from '../../constants';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalContextProvider } from '../../../context-store/context';
import formatBalanceAmount from '../formatNumber';
import ThemeText from './textTheme';
import { formatCurrency } from '../formatCurrency';
import { useMemo, useState } from 'react';
import { useAppStatus } from '../../../context-store/appStatus';
import { HIDDEN_OPACITY } from '../../constants/theme';

export default function FormattedBalanceInput({
  amountValue = 0,
  containerFunction,
  inputDenomination,
  customTextInputContainerStyles,
  customTextInputStyles,
  activeOpacity = 0.2,
  maxWidth = 0.95,
  customCurrencyCode = '',
  forceCurrency = false,
}) {
  const { screenDimensions } = useAppStatus();
  const [inputWidth, setInputWidth] = useState(0);
  const [labelWidth, setLabelWidth] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const { masterInfoObject } = useGlobalContextProvider();

  const currencyText = forceCurrency || masterInfoObject.fiatCurrency || 'USD';
  const showSymbol = masterInfoObject.satDisplay != 'word';

  const currencyInfo = useMemo(
    () =>
      formatCurrency({
        amount: 0,
        code: currencyText,
      }),
    [currencyText],
  );

  const isSymbolInFront = currencyInfo[3];
  const currencySymbol = currencyInfo[2];
  const { textColor } = GetThemeColors();
  const showSats =
    inputDenomination === 'sats' || inputDenomination === 'hidden';

  const maxContainerWidth = screenDimensions.width * maxWidth;
  const availableInputWidth = useMemo(() => {
    if (labelWidth === 0) return 0;

    const remainingWidth = maxContainerWidth - labelWidth;
    return Math.max(0, Math.min(inputWidth, remainingWidth));
  }, [inputWidth, labelWidth, maxContainerWidth]);

  if (customCurrencyCode) {
    return (
      <View
        onTouchEnd={() => {
          if (!isScrolling && containerFunction) {
            containerFunction();
          }
        }}
        style={[
          styles.textInputContainer,
          {
            opacity: !amountValue ? HIDDEN_OPACITY : 1,
            maxWidth: maxContainerWidth,
            ...customTextInputContainerStyles,
          },
        ]}
      >
        <View style={[styles.inputWrapper, { width: availableInputWidth }]}>
          <ScrollView
            onTouchStart={() => setIsScrolling(false)}
            onTouchMove={() => setIsScrolling(true)}
            onTouchEnd={() => setIsScrolling(false)}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <TextInput
              style={[
                styles.textInput,
                { color: textColor },
                customTextInputStyles,
              ]}
              value={formatBalanceAmount(amountValue, false, masterInfoObject)}
              editable={false}
              scrollEnabled
              multiline={false}
            />
          </ScrollView>
        </View>
        <View
          onLayout={e => {
            console.log(e.nativeEvent.layout, 'layout change');
            setLabelWidth(e.nativeEvent.layout.width);
          }}
        >
          <ThemeText
            styles={styles.satText}
            content={
              customCurrencyCode.length > 4
                ? customCurrencyCode.toUpperCase()?.slice(0, 3) + '..'
                : customCurrencyCode.toUpperCase()
            }
          />
        </View>
        {/* Hidden Text for Measuring Width */}
        <Text
          style={styles.hiddenText}
          onLayout={e => {
            console.log(e.nativeEvent.layout.width, 'INPUT WIDTH');
            const measuredWidth =
              e.nativeEvent.layout.width + (Platform.OS === 'android' ? 10 : 5);
            setInputWidth(measuredWidth);
          }}
        >
          {formatBalanceAmount(amountValue, false, masterInfoObject)}
        </Text>
      </View>
    );
  }

  return (
    <View
      onTouchEnd={() => {
        if (!isScrolling && containerFunction) {
          containerFunction();
        }
      }}
      style={[
        styles.textInputContainer,
        {
          opacity: !amountValue ? HIDDEN_OPACITY : 1,
          maxWidth: maxContainerWidth,
          ...customTextInputContainerStyles,
        },
      ]}
    >
      {isSymbolInFront && !showSats && showSymbol && (
        <ThemeText styles={styles.satText} content={currencySymbol} />
      )}
      {showSats && showSymbol && (
        <ThemeText styles={styles.satText} content={BITCOIN_SATS_ICON} />
      )}
      <View style={[styles.inputWrapper, { width: inputWidth }]}>
        <ScrollView
          onTouchStart={() => setIsScrolling(false)}
          onTouchMove={() => setIsScrolling(true)}
          onTouchEnd={() => setIsScrolling(false)}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <TextInput
            style={[
              styles.textInput,
              { color: textColor },
              customTextInputStyles,
            ]}
            value={formatBalanceAmount(amountValue, false, masterInfoObject)}
            editable={false}
            scrollEnabled
            multiline={false}
          />
        </ScrollView>
      </View>
      {!isSymbolInFront && !showSats && showSymbol && (
        <ThemeText styles={styles.satText} content={currencySymbol} />
      )}
      {!showSymbol && !showSats && (
        <ThemeText styles={styles.satText} content={currencyText} />
      )}
      {!showSymbol && showSats && (
        <ThemeText content={`${BITCOIN_SAT_TEXT}`} styles={styles.satText} />
      )}
      {/* Hidden Text for Measuring Width */}
      <Text
        style={styles.hiddenText}
        onLayout={e => {
          console.log(e.nativeEvent.layout.width, 'INPUT WIDTH');
          const newWidth = Math.min(
            e.nativeEvent.layout.width + (Platform.OS === 'android' ? 10 : 5),
            screenDimensions.width * maxWidth,
          );
          setInputWidth(newWidth);
        }}
      >
        {formatBalanceAmount(amountValue, false, masterInfoObject)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  textInputContainer: {
    width: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...CENTER,
  },
  textInput: {
    fontSize: 40,
    includeFontPadding: false,
    pointerEvents: 'none',
    paddingVertical: 0,
    fontFamily: FONT.Title_Regular,
  },
  satText: {
    fontSize: 40,
    includeFontPadding: false,
  },
  hiddenText: {
    position: 'absolute',
    zIndex: -1,
    fontSize: 40,
    opacity: 0,
    includeFontPadding: false,
    fontFamily: FONT.Title_Regular,
  },
});
