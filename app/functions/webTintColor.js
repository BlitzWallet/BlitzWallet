import { Platform } from 'react-native';
import { COLORS } from '../constants';

// expo-image `tintColor` is a no-op on react-native-web, so map the only three
// tint colors used across the app to equivalent CSS filters applied to black.
// white + lightModeText are exact (neutral, invert only); primary is a sosuke
// approximation (has hue). No arbitrary colors are ever tinted, so no solver.
const WEB_TINT_FILTERS = {
  [COLORS.primary]:
    'brightness(0) saturate(100%) invert(33%) sepia(97%) saturate(3256%) hue-rotate(202deg) brightness(102%) contrast(98%)',
  [COLORS.darkModeText]: 'brightness(0) invert(1)', // white
  [COLORS.lightModeText]: 'brightness(0) invert(15%)', // #262626
};

// Platform-correct tint style fragment. Spread into an Image style.
export function tintStyle(tintColor) {
  if (!tintColor) return {};
  if (Platform.OS !== 'web') return { tintColor };
  const filter = WEB_TINT_FILTERS[tintColor];
  return filter ? { filter } : { tintColor }; // unknown color: harmless no-op on web
}
