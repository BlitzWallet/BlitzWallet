import LottieView from 'lottie-react-native';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useReducedMotion } from '../../constants/motion';

// Honours reduced motion: shows the final frame, no autoplay/loop, unless
// keepPlaying (loaders) is set. The only file in app/ that imports lottie.
const MotionLottie = forwardRef(({ keepPlaying = false, ...props }, ref) => {
  const innerRef = useRef(null);
  const frozen = useReducedMotion() && !keepPlaying;

  useImperativeHandle(
    ref,
    () => ({
      play: (...a) => !frozen && innerRef.current?.play?.(...a),
      pause: () => !frozen && innerRef.current?.pause?.(),
      reset: () => !frozen && innerRef.current?.reset?.(),
    }),
    [frozen],
  );

  return (
    <LottieView
      {...props}
      ref={innerRef}
      {...(frozen ? { autoPlay: false, loop: false, progress: 1 } : null)}
    />
  );
});

export default MotionLottie;
