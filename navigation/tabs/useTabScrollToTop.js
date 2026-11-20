import { useCallback } from 'react';
import { useFocusEffect, useRoute } from '@react-navigation/native';

// Tab screens stay mounted when another tab is selected, so their scroll
// offset would otherwise survive the switch. The tab bar asks for a reset when
// it selects a tab; the tab being switched to is not focused yet, so it parks
// the request and applies it from its focus effect.
const pendingReset = new Set();
const focusedReset = new Map();

export function requestTabScrollToTop(routeName) {
  const reset = focusedReset.get(routeName);
  // Already selected: the screen is mounted, so it can scroll right away.
  if (reset) reset(true);
  else pendingReset.add(routeName);
}

export function useTabScrollToTop(scrollRef) {
  const { name } = useRoute();

  useFocusEffect(
    useCallback(() => {
      const reset = animated =>
        scrollRef.current?.scrollTo({ y: 0, animated });
      focusedReset.set(name, reset);

      if (pendingReset.delete(name)) reset(false);

      return () => {
        if (focusedReset.get(name) === reset) focusedReset.delete(name);
      };
    }, [name, scrollRef]),
  );
}
