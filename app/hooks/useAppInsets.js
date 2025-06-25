import {Platform} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ANDROIDSAFEAREA} from '../constants/styles';

export default function useAppInsets() {
  const insets = useSafeAreaInsets();

  const topPadding = Platform.select({
    ios: insets.top,
    android: insets.top + 5,
  });

  const bottomPadding = Platform.select({
    ios: insets.bottom,
    android: insets.bottom + 5,
  });

  console.log(topPadding, bottomPadding, 'ETSTING');

  return {
    topPadding: topPadding !== 0 ? topPadding : ANDROIDSAFEAREA,
    bottomPadding: bottomPadding !== 0 ? bottomPadding : ANDROIDSAFEAREA,
  };
}
