import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../../constants';
import ThemeIcon from './themeIcon';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import {
  normalizeDisplayCurrency,
  SATS_DISPLAY_CURRENCY,
} from '../displayCurrency';

export default function CurrencySwitchButton({
  displayCurrency,
  onPress,
  disabled,
}) {
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const isFiat =
    normalizeDisplayCurrency(displayCurrency) !== SATS_DISPLAY_CURRENCY;

  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} hitSlop={10}>
      <View
        style={[
          styles.circle,
          {
            backgroundColor:
              theme && darkModeType ? backgroundColor : backgroundOffset,
          },
        ]}
      >
        {disabled ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <>
            <ThemeIcon iconName="RotateCw" size={25} />
            <View style={styles.symbol} pointerEvents="none">
              <ThemeIcon
                iconName={isFiat ? 'Bitcoin' : 'DollarSign'}
                size={11}
              />
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
