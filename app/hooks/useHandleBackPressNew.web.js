import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { navigationRef } from '../../navigation/navigationService';

// react-native-web's BackHandler is a stub and browser/Android back is just
// history.back(). Keep one trap entry above the page so back fires popstate,
// then run the same LIFO stack BackHandler does on native, falling back to
// goBack like React Navigation's native useBackButton.
const handlers = [];

// Arm on a tap: Chrome skips entries pushed without user activation.
window.addEventListener(
  'pointerup',
  () => {
    if (!window.history.state?.blitzBackTrap) {
      window.history.pushState({ blitzBackTrap: true }, '');
    }
  },
  true,
);

window.addEventListener('popstate', event => {
  if (event.state?.blitzBackTrap) return; // our own forward() below
  if (!handlers.some(cb => cb())) {
    // Root: leave the trap spent so the next back exits, like exitApp().
    if (!navigationRef.canGoBack()) return;
    navigationRef.goBack();
  }
  // Re-arm without creating an entry; a pushState here would be skippable.
  window.history.forward();
});

export default function useHandleBackPressNew(callback) {
  useFocusEffect(
    useCallback(() => {
      if (!callback) return;
      handlers.unshift(callback);
      return () => {
        handlers.splice(handlers.indexOf(callback), 1);
      };
    }, [callback]),
  );
}
