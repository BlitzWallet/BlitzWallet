import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Simple, reliable back handler hook
 * Only use when you need to OVERRIDE default navigation behavior
 *
 * @param {Function} handler - Function that returns true to block default behavior, false to allow it
 * @param {Array} deps - Dependencies array for the handler
 */
export function useBackHandler(handler, deps = []) {
  const savedHandler = useRef(handler);

  // Keep handler reference fresh
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = () => {
      // Call the latest handler
      return savedHandler.current?.() ?? false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      backHandler,
    );

    return () => subscription.remove();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
