// Redesign motion constants (audit/IMPLEMENTATION_PLAN.md §10 T7).
// Presentation only: callers skip or shorten animations when
// useReducedMotion() is true (O-5); no logic may depend on it.
export { useReducedMotion } from 'react-native-reanimated';

export const sheetSpring = { damping: 30, stiffness: 300 };
export const digitSpring = { damping: 30, stiffness: 500 };
export const successPop = { damping: 18, stiffness: 260 };
export const pressScale = 0.98;

// No haptics in the redesign (OQ-7). Kept so call sites stay stable.
export function haptic(kind) {}
