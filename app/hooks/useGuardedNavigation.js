import { useCallback, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';

// Minimum spacing (ms) between navigations triggered from the same component.
// Rapid, overlapping native-stack transitions are what drive the Fabric /
// react-native-screens view-mounting crashes ("Unable to find viewState for
// tag …" / "No view found for id … for fragment ScreenFragment"), so we drop
// presses that land inside the in-flight transition window of the previous one.
const NAV_GUARD_MS = 600;

/**
 * Returns a throttled drop-in for `navigation.navigate(...)`. Calls that arrive
 * within NAV_GUARD_MS of the previous accepted call are ignored, preventing a
 * second native screen from being pushed while the first is still mounting.
 */
export default function useGuardedNavigation() {
  const navigation = useNavigation();
  const lastNavAtRef = useRef(0);

  return useCallback(
    (...args) => {
      const now = Date.now();
      if (now - lastNavAtRef.current < NAV_GUARD_MS) return;
      lastNavAtRef.current = now;
      navigation.navigate(...args);
    },
    [navigation],
  );
}
