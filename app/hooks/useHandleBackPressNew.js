import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

/**
 * Custom hook to handle hardware back button press on Android
 * Properly handles app state changes and listener cleanup
 * @param {Function|null} callback - Function to execute on back press.
 *                                   If null/undefined, default navigation behavior is used
 * @param {boolean} shouldExitApp - If true and callback is null, exits the app instead of navigating back
 */
export default function useHandleBackPressNew(callback, shouldExitApp = false) {
  useFocusEffect(
    // `callback` MUST stay in the deps. React Native's BackHandler is a global
    // LIFO stack (last added is called first). When an inner overlay opens, its
    // callback identity changes, which re-subscribes the listener and moves it
    // to the top of the stack so it intercepts the back press before the stable
    // screen-level handler that would otherwise close the whole modal. Dropping
    // `callback` here makes nested overlays (mobile money, pools, savings, swaps,
    // etc.) stop receiving back presses.
    useCallback(() => {
      const onBackPress = () => {
        if (callback) {
          return callback();
        }
        return false;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );

      return () => {
        subscription.remove();
      };
    }, [callback, shouldExitApp]),
  );
}
