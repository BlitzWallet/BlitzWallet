// Redesign motion constants (audit/IMPLEMENTATION_PLAN.md §10 T7).
// Presentation only: callers skip or shorten animations when
// useReducedMotion() is true (O-5); no logic may depend on it.
import { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
export { useReducedMotion, ReduceMotion } from 'react-native-reanimated';

// Reduced-motion fade: the one crossfade duration (ms).
export const fadeMs = 150;
// Pass `reduced` from useReducedMotion(). Never-reduce so the fade itself plays.
export const enterAnim = (anim, reduced) =>
  reduced ? FadeIn.duration(fadeMs).reduceMotion(ReduceMotion.Never) : anim;
export const exitAnim = (anim, reduced) =>
  reduced ? FadeOut.duration(fadeMs).reduceMotion(ReduceMotion.Never) : anim;
// Navigation `animation:` option: 'none' stays, everything else fades.
export const screenAnimation = (name, reduced) =>
  name === 'none' || !reduced ? name : 'fade';

export const sheetSpring = { damping: 30, stiffness: 300 };
export const digitSpring = { damping: 30, stiffness: 500 };
export const successPop = { damping: 18, stiffness: 260 };
export const pressScale = 0.98;

// No haptics in the redesign (OQ-7). Kept so call sites stay stable.
export function haptic(kind) {}
