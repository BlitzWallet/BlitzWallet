import {Platform} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useEffect, useMemo, useState} from 'react';
import {ANDROIDSAFEAREA} from '../constants/styles';

export default function useAppInsets() {
  const insets = useSafeAreaInsets();
  const [isStable, setIsStable] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsStable(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const {topPadding, bottomPadding} = useMemo(() => {
    if (!isStable) {
      return {
        topPadding: Platform.select({
          ios: insets.top,
          android: insets.top,
        }),
        bottomPadding: Platform.select({
          ios: insets.bottom,
          android: insets.bottom,
        }),
      };
    }
    const topPadding = Platform.select({
      ios: insets.top,
      android: insets.top,
    });

    const bottomPadding = Platform.select({
      ios: insets.bottom,
      android: insets.bottom,
    });

    return {
      topPadding: topPadding !== 0 ? topPadding : ANDROIDSAFEAREA,
      bottomPadding: bottomPadding !== 0 ? bottomPadding : ANDROIDSAFEAREA,
    };
  }, [insets.top, insets.bottom, isStable]);

  console.log(topPadding, bottomPadding, 'TESTING');
  return {topPadding, bottomPadding};
}
