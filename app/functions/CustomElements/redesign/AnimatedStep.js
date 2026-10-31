import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';

export const PAGE_DURATION = 250;
// halfModal.js animates contentHeight changes over this long.
const SHEET_RESIZE_DURATION = 200;

// Slides a step in or out when it becomes (in)active, like the online
// listings filter sheet. `direction` is 1 when moving forward through the
// steps and -1 when going back. Reanimated keeps the exiting props from
// the last render while active, so the exit side can't come from `direction`
// (it is updated in the same render that unmounts the step): `exitsBack` fixes
// it per step instead. `fadeOnly` drops the slide (result screens).
export default function AnimatedStep({
  active,
  direction,
  exitsBack = false,
  fadeOnly = false,
  children,
}) {
  const isFirstRender = useRef(true);

  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  if (!active) return null;

  const enteringSlide = direction === 1 ? SlideInRight : SlideInLeft;
  const exitingSlide = exitsBack ? SlideOutRight : SlideOutLeft;

  return (
    <Animated.View
      entering={
        isFirstRender.current ? undefined : FadeIn.duration(PAGE_DURATION)
      }
      exiting={FadeOut.duration(PAGE_DURATION)}
      style={styles.page}
    >
      <Animated.View
        entering={
          isFirstRender.current || fadeOnly
            ? undefined
            : enteringSlide.duration(PAGE_DURATION)
        }
        exiting={fadeOnly ? undefined : exitingSlide.duration(PAGE_DURATION)}
        style={styles.page}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: {
    ...StyleSheet.absoluteFillObject,
  },
});

// Sheet height for a stepped sheet. Resizing mid-slide reflows the sliding
// step every frame (visible jiggle), so the two never overlap: a shrink waits
// for the outgoing step to slide away, and a grow happens before the step
// changes (see growThenStep).
export function useStepSheetHeight(setContentHeight, height) {
  const lastHeight = useRef(0);
  useEffect(() => {
    const grow = height >= lastHeight.current;
    lastHeight.current = height;
    if (grow) {
      setContentHeight(height);
      return;
    }
    const timer = setTimeout(() => setContentHeight(height), PAGE_DURATION);
    return () => clearTimeout(timer);
  }, [height, setContentHeight]);
}

// Runs `changeStep` after the sheet has grown to `toHeight` when the next step
// is taller, so its slide-in starts at the final size; otherwise at once.
export function growThenStep(
  setContentHeight,
  fromHeight,
  toHeight,
  changeStep,
) {
  if (toHeight > fromHeight) {
    setContentHeight(toHeight);
    setTimeout(changeStep, SHEET_RESIZE_DURATION);
    return;
  }
  changeStep();
}
