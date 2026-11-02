import LottieView from 'lottie-react-native';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import {
  getConfirmTxAnimation,
  getErrorTxAnimation,
} from '../../lottieAnimations';

// Hero for a full-page / sheet result: the themed confirm checkmark or error
// cross Lottie (same assets as confirmTxPage). Plays once on mount, so mount
// it only when the result is showing. Small checks and status glyphs stay on
// ThemeIcon / Disc.
export default function ResultAnimation({ type = 'success', size = 125 }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const source =
    type === 'error'
      ? getErrorTxAnimation(theme, darkModeType)
      : getConfirmTxAnimation(theme, darkModeType);
  return (
    <LottieView
      source={source}
      renderMode="SOFTWARE"
      loop={false}
      autoPlay
      style={{ width: size, height: size }}
    />
  );
}
