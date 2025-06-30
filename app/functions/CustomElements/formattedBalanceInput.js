import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  BITCOIN_SAT_TEXT,
  BITCOIN_SATS_ICON,
  CENTER,
  FONT,
  SIZES,
} from '../../constants';
import GetThemeColors from '../../hooks/themeColors';
import {useGlobalContextProvider} from '../../../context-store/context';
import formatBalanceAmount from '../formatNumber';
import ThemeText from './textTheme';
import {formatCurrency} from '../formatCurrency';
import {useMemo, useState} from 'react';
import {useNodeContext} from '../../../context-store/nodeContext';

export default function FormattedBalanceInput({
  amountValue = 0,
  containerFunction,
  inputDenomination,
  customTextInputContainerStyles,
  customTextInputStyles,
  activeOpacity = 0.2,
  maxWidth = 0.95,
}) {
  const [inputWidth, setInputWidth] = useState(50); // Start with a small width
  const [isScrolling, setIsScrolling] = useState(false);
  const windowWidth = useWindowDimensions().width;
  const {masterInfoObject} = useGlobalContextProvider();
  const {fiatStats} = useNodeContext();
  const currencyText = fiatStats.coin || 'USD';
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
  const {textColor} = GetThemeColors();

  const showSats =
    inputDenomination === 'sats' || inputDenomination === 'hidden';

  return (
    <View
      onTouchEnd={() => {
        console.log(isScrolling, 'IS SCROLLING');
        if (!isScrolling && containerFunction) {
          containerFunction();
        }
      }}
      style={[
        styles.textInputContainer,
        {
          opacity: !amountValue ? 0.5 : 1,
          ...customTextInputContainerStyles,
        },
      ]}>
      {isSymbolInFront && !showSats && showSymbol && (
        <ThemeText styles={styles.satText} content={currencySymbol} />
      )}
      {showSats && showSymbol && (
        <ThemeText styles={styles.satText} content={BITCOIN_SATS_ICON} />
      )}

      <View style={[styles.inputWrapper, {width: inputWidth}]}>
        <ScrollView
          onTouchStart={() => setIsScrolling(false)}
          onTouchMove={() => setIsScrolling(true)}
          onTouchEnd={() => setIsScrolling(false)}
          horizontal
          showsHorizontalScrollIndicator={false}>
          <TextInput
            style={[
              styles.textInput,
              {color: textColor},
              customTextInputStyles,
            ]}
            value={formatBalanceAmount(amountValue)}
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
      {/* Hidden Text for Measuring Width stupid but works */}
      <Text
        style={styles.hiddenText}
        onLayout={e => {
          console.log(e.nativeEvent.layout.width, 'INPUT WIDTH');
          const newWidth = Math.min(
            e.nativeEvent.layout.width + (Platform.OS === 'android' ? 10 : 5),
            windowWidth * maxWidth,
          );
          setInputWidth(newWidth);
        }}>
        {formatBalanceAmount(amountValue)}
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
