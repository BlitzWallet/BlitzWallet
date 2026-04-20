import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { COLORS } from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import { ICONS } from '../../../../constants';

const PILL_WIDTH = 70;
const PILL_HEIGHT = 35;
const THUMB_SIZE = 31;
const THUMB_PADDING = 2;

export default function AnalyticsToggle({ denomination, onToggle }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textColor } = GetThemeColors();

  // 0 = left (sats/₿), 1 = right (fiat/$)
  const isFiat = denomination === 'fiat';
  const slideX = useSharedValue(
    isFiat ? PILL_WIDTH - THUMB_SIZE - THUMB_PADDING : THUMB_PADDING,
  );

  useEffect(() => {
    slideX.value = withTiming(
      isFiat ? PILL_WIDTH - THUMB_SIZE - THUMB_PADDING : THUMB_PADDING,
      {
        duration: 200,
      },
    );
  }, [isFiat]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  const pillBg = theme && darkModeType ? backgroundOffset : backgroundOffset;
  const thumbBg = theme && darkModeType ? COLORS.darkModeText : COLORS.primary;
  const thubSelected = textColor;
  const thubColor =
    theme && darkModeType ? COLORS.lightModeText : COLORS.darkModeText;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onToggle}
      style={[styles.pill, { backgroundColor: pillBg }]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {/* Labels */}
      <View style={styles.labelRow}>
        <ThemeImage
          lightModeIcon={ICONS.bitcoinIcon}
          darkModeIcon={ICONS.bitcoinIcon}
          lightsOutIcon={ICONS.bitcoinIcon}
          styles={{
            tintColor: isFiat ? thubSelected : thubColor,
            width: 16,
            height: 16,
          }}
        />
        <ThemeImage
          lightModeIcon={ICONS.dollarIcon}
          darkModeIcon={ICONS.dollarIcon}
          lightsOutIcon={ICONS.dollarIcon}
          styles={{
            tintColor: !isFiat ? thubSelected : thubColor,
            width: 16,
            height: 16,
          }}
        />
      </View>
      {/* Sliding thumb */}
      <Animated.View
        style={[styles.thumb, { backgroundColor: thumbBg }, thumbStyle]}
        pointerEvents="none"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    justifyContent: 'center',
    position: 'absolute',
    overflow: 'hidden',
    right: 0,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 1,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    top: 2,
    left: 0,
    zIndex: 0,
  },
});
