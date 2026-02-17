import { useCallback, useEffect, useState } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

/**
 * Shared hook for pool creation multi-step flow
 * Used by both PoolCreationOverlay (receive modal) and CreatePoolFlow (settings modal)
 *
 * @param {Function} onComplete - Callback when pool creation is complete
 * @param {Function} onCancel - Callback when flow is canceled
 */
export const usePoolCreationFlow = ({ onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState('amount'); // 'amount' | 'description'
  const [goalAmount, setGoalAmount] = useState(null);

  // Amount overlay animation
  const amountOpacity = useSharedValue(1);
  const amountTranslateX = useSharedValue(0);

  // Description overlay animation
  const descOpacity = useSharedValue(0);
  const descTranslateX = useSharedValue(30);

  useEffect(() => {
    if (currentStep === 'description') {
      // Hide amount, show description
      amountOpacity.value = withTiming(0, { duration: 250 });
      amountTranslateX.value = withTiming(-30, { duration: 250 });
      descOpacity.value = withTiming(1, { duration: 250 });
      descTranslateX.value = withTiming(0, { duration: 250 });
    } else {
      // Show amount, hide description
      amountOpacity.value = withTiming(1, { duration: 250 });
      amountTranslateX.value = withTiming(0, { duration: 250 });
      descOpacity.value = withTiming(0, { duration: 250 });
      descTranslateX.value = withTiming(30, { duration: 250 });
    }
  }, [currentStep]);

  const amountStyle = useAnimatedStyle(() => ({
    opacity: amountOpacity.value,
    transform: [{ translateX: amountTranslateX.value }],
    pointerEvents: amountOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  const descStyle = useAnimatedStyle(() => ({
    opacity: descOpacity.value,
    transform: [{ translateX: descTranslateX.value }],
    pointerEvents: descOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  return {
    currentStep,
    goalAmount,
    setGoalAmount,
    setCurrentStep,
    amountStyle,
    descStyle,
    onComplete,
    onCancel,
  };
};
