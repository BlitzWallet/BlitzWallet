import { StyleSheet, View } from 'react-native';
import { COLORS, SIZES } from '../../../../constants';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeImage from '../../../../functions/CustomElements/themeImage';

// Circular badge used in the currency picker. Renders a brand icon (Bitcoin /
// Dollars) when `iconImage` is passed, otherwise the fiat currency symbol.
export default function CurrencyCoin({
  symbol,
  iconImage,
  backgroundColor,
  size = 44,
}) {
  return (
    <View
      style={[
        styles.coin,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
      ]}
    >
      {iconImage ? (
        <ThemeImage
          styles={{ width: size * 0.55, height: size * 0.55 }}
          lightModeIcon={iconImage}
          darkModeIcon={iconImage}
          lightsOutIcon={iconImage}
        />
      ) : (
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.symbol}
          content={symbol}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  coin: {
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  symbol: {
    fontSize: SIZES.medium,
    fontWeight: 500,
    includeFontPadding: false,
  },
});
