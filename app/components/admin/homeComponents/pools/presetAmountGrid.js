import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { SATSPERBITCOIN } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';

const PRESET_AMOUNTS_USD = [5, 10, 25, 50, 100];

/**
 * Preset amount selection grid: $5, $10, $25, $50, $100 and Other, in
 * 2 rows of 3.
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
  const { masterInfoObject } = useGlobalContextProvider();
  const { tokens } = GetThemeColors();
  const { t } = useTranslation();

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

  const renderButton = item => {
    const selected = item.isCustomButton
      ? isCustomSelected()
      : isPresetSelected(item);
    return (
      <TouchableOpacity
        key={item.isCustomButton ? 'custom' : item.usd}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={
          item.isCustomButton ? handleCustomAmount : () => handleSelect(item)
        }
        style={[
          styles.presetButton,
          {
            backgroundColor: tokens.disc,
            borderColor: selected ? tokens.accent : 'transparent',
          },
        ]}
      >
        <ThemeText
          styles={styles.presetText}
          content={
            item.isCustomButton
              ? t('wallet.pools.other')
              : displayCorrectDenomination({
                  amount: isFiatMode ? item.usd : item.sats,
                  masterInfoObject,
                  fiatStats,
                  convertAmount: !isFiatMode,
                })
          }
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.grid}>
      {[allItems.slice(0, 3), allItems.slice(3, 6)].map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map(item => renderButton(item))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  presetButton: {
    flex: 1,
    flexBasis: 0,
    minHeight: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    paddingHorizontal: 8,
  },
  presetText: {
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
});
