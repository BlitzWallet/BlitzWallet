import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { SIZES, SATSPERBITCOIN } from '../../../../constants';
import { COLORS } from '../../../../constants/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';

const PRESET_AMOUNTS_USD = [5, 10, 25, 50, 100];

/**
 * Cash App-style preset amount selection grid.
 * Shows $5, $10, $25, $50, $100 and a "..." for custom amounts.
 * Dynamically adjusts to 2 rows of 3 or 3 rows of 2 based on content width.
 *
 * @param {function} onSelectPreset - Called with sats (number) when a preset is selected
 * @param {number} selectedAmountSats - Currently selected amount in sats (for highlight)
 * @param {Object} fiatStats - Fiat conversion stats { value: pricePerBTC }
 */
export default function PresetAmountGrid({
  onSelectPreset,
  selectedAmountSats = 0,
  fiatStats,
  onCustomPress,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  const fiatPrice = fiatStats?.value || 0;
  const isFiatMode = masterInfoObject.userBalanceDenomination === 'fiat';

  // Convert USD to sats using current BTC price
  const usdToSats = usdAmount => {
    if (!fiatPrice || fiatPrice <= 0) return 0;
    return Math.round((usdAmount / fiatPrice) * SATSPERBITCOIN);
  };

  // Create preset objects with both representations
  const presets = PRESET_AMOUNTS_USD.map(usd => ({
    usd,
    sats: usd * 1000, // Fixed sats amount
    satValueOfUsd: usdToSats(usd), // Dynamic conversion based on BTC price
  }));

  const handleCustomAmount = () => {
    if (onCustomPress) {
      onCustomPress();
    }
  };

  const handleSelect = preset => {
    onSelectPreset(isFiatMode ? preset.satValueOfUsd : preset.sats);
  };

  const isPresetSelected = preset => {
    if (!selectedAmountSats) return false;
    const presetValue = isFiatMode ? preset.satValueOfUsd : preset.sats;
    return selectedAmountSats === presetValue;
  };

  const isCustomSelected = () => {
    if (!selectedAmountSats) return false;
    return !presets.some(preset => {
      const presetValue = isFiatMode ? preset.satValueOfUsd : preset.sats;
      return selectedAmountSats === presetValue;
    });
  };

  // Create all items (presets + custom)
  const allItems = [...presets, { isCustomButton: true }];

  // Split into rows based on layout
  const rows = [
    allItems.slice(0, 2),
    allItems.slice(2, 4),
    allItems.slice(4, 6),
  ];

  const renderButton = item => {
    if (item.isCustomButton) {
      return (
        <TouchableOpacity
          key="custom"
          activeOpacity={0.7}
          onPress={handleCustomAmount}
          style={[
            styles.presetButton,
            {
              backgroundColor: theme
                ? darkModeType
                  ? backgroundColor
                  : backgroundOffset
                : COLORS.darkModeText,
              borderColor: isCustomSelected()
                ? theme
                  ? COLORS.darkModeText
                  : COLORS.primary
                : 'transparent',
            },
          ]}
        >
          <ThemeText styles={styles.presetText} content={'...'} />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={item.usd}
        activeOpacity={0.7}
        onPress={() => handleSelect(item)}
        style={[
          styles.presetButton,
          {
            backgroundColor: theme
              ? darkModeType
                ? backgroundColor
                : backgroundOffset
              : COLORS.darkModeText,
            borderColor: isPresetSelected(item)
              ? theme
                ? COLORS.darkModeText
                : COLORS.primary
              : 'transparent',
          },
        ]}
      >
        <ThemeText
          styles={styles.presetText}
          content={displayCorrectDenomination({
            amount: isFiatMode ? item.usd : item.sats,
            masterInfoObject,
            fiatStats,
            convertAmount: !isFiatMode,
          })}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map(item => renderButton(item))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  presetButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    paddingHorizontal: 8,
  },
  presetText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
});
