import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';

// Fallback if transitionEnd never fires (no animation, web, or a screen that
// mounted already settled).
const FALLBACK_MS = 700;

// false while this screen's push animation runs, true once it settles. Gate
// heavy work (SQL reads, big filters, wallet connects) on it so it doesn't
// jank the animation. Screens inside a nested navigator that animate with
// 'none' should pass the parent navigation, which owns the real push.
export default function useAfterTransition(navigationOverride) {
  const ownNavigation = useNavigation();
  const navigation = navigationOverride || ownNavigation;
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const done = () => setIsReady(true);
    const unsubscribe = navigation.addListener('transitionEnd', done);
    const timeout = setTimeout(done, FALLBACK_MS);
    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigation]);

  return isReady;
}
