import { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS, SIZES } from '../../../../constants';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import { ThemeText } from '../../../../functions/CustomElements';
import { getCurrencySymbol } from '../../../../functions/displayCurrency';
import CurrencyCoin from './currencyCoin';

const CurrencyRow = memo(
  ({
    currency,
    isSelected,
    onSelect,
    theme,
    darkModeType,
    backgroundOffset,
    iconBackground,
  }) => {
    const borderColor =
      theme && darkModeType ? COLORS.darkModeText : COLORS.primary;

    return (
      <TouchableOpacity
        style={[
          styles.currencyRow,
          {
            borderColor: isSelected ? borderColor : 'transparent',
            backgroundColor: backgroundOffset,
          },
        ]}
        onPress={() => onSelect(currency.id)}
      >
        <CurrencyCoin
          symbol={getCurrencySymbol(currency.id)}
          backgroundColor={iconBackground}
          size={38}
        />
        <View style={styles.currencyTextContainer}>
          <ThemeText
            styles={styles.currencyName}
            content={currency.info.name}
          />
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.currencyCode}
            content={currency.id}
          />
        </View>
        <CheckMarkCircle
          switchDarkMode={true}
          containerSize={20}
          isActive={isSelected}
        />
      </TouchableOpacity>
    );
  },
);

export default CurrencyRow;

const styles = StyleSheet.create({
  currencyRow: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 8,
    gap: 12,
  },
  currencyTextContainer: {
    flex: 1,
  },
  currencyName: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  currencyCode: {
    fontSize: SIZES.small,
    opacity: 0.6,
    includeFontPadding: false,
    marginTop: 2,
  },
});
