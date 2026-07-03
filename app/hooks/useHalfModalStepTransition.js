import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * Standard half-modal step transition (fade + directional translateX), modeled on
 * CreateAccumulationAddressModal. Lets step-based flows that render via early-return
 * branches animate between steps without duplicating the animation logic.
 *
 * @param {string} page  The active page key.
 * @param {string[]} order  Ordered list of page keys — defines slide direction.
 * @returns {{ renderedPage: string, pageAnimatedStyle: object }} Render JSX off
 *   renderedPage and wrap it in an Animated.View with pageAnimatedStyle. Keep all
 *   logic/height/back behavior on the live `page`.
 */
export default function useHalfModalStepTransition(page, order) {
  const opacity = useSharedValue(1);
  const translateX = useSharedValue(0);
  const [renderedPage, setRenderedPage] = useState(page);
  const renderedRef = useRef(page);

  const animateIn = useCallback(
    (next, forward) => {
      renderedRef.current = next;
      setRenderedPage(next);
      translateX.value = forward ? 30 : -30;
      opacity.value = withTiming(1, { duration: 125 });
      translateX.value = withTiming(0, { duration: 125 });
    },
    [opacity, translateX],
  );

  useEffect(() => {
    if (page === renderedRef.current) return;
    const forward = order.indexOf(page) > order.indexOf(renderedRef.current);
    opacity.value = withTiming(0, { duration: 125 });
    translateX.value = withTiming(
      forward ? -30 : 30,
      { duration: 125 },
      fin => {
        if (fin) scheduleOnRN(animateIn, page, forward);
      },
    );
  }, [page]);

  useEffect(() => {
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(translateX);
    };
  }, []);

  const pageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return { renderedPage, pageAnimatedStyle };
}
