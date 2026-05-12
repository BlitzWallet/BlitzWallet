import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * Custom hook to handle hardware back button press on Android
 * Properly handles app state changes and listener cleanup
 * @param {Function|null} callback - Function to execute on back press.
 *                                   If null/undefined, default navigation behavior is used
 * @param {boolean} shouldExitApp - If true and callback is null, exits the app instead of navigating back
 */
export default function useHandleBackPressNew(callback, shouldExitApp = false) {
  const subscriptionRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      console.log('Setting up back handler for screen');

      const onBackPress = () => {
        console.log('Back button pressed', {
          hasCallback: !!callback,
          shouldExitApp,
        });

        if (callback) {
          // Execute custom callback
          return callback();
        } else {
          // Return false to allow default back navigation (pop screen)
          return false;
        }
      };

      // Remove any existing subscription before adding new one
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }

      // Add new subscription
      subscriptionRef.current = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );

      console.log('Back handler listener added');

      return () => {
        console.log('Cleaning up back handler listener');
        if (subscriptionRef.current) {
          subscriptionRef.current.remove();
          subscriptionRef.current = null;
        }
      };
    }, [callback, shouldExitApp]),
  );
}
