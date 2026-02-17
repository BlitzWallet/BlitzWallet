import { useEffect, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { usePoolCreationFlow } from './poolCreationSharedLogic';
import PoolAmountInput from './components/poolAmountInput';
import PoolDescriptionInput from './components/poolDescriptionInput';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useAppStatus } from '../../../../../context-store/appStatus';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { useKeyboardState } from 'react-native-keyboard-controller';

/**
 * Pool Creation Overlay Component
 * Used inside HomeLightningReceiveOptions to create pools without opening a new modal
 * Uses the overlay pattern (similar to AddContactOverlay, AmountInputOverlay)
 *
 * @param {Boolean} visible - Controls overlay visibility
 * @param {Function} onClose - Callback when overlay should close
 * @param {Object} theme - Theme object
 * @param {Boolean} darkModeType - Dark mode flag
 * @param {Function} handleBackPressFunction - Back press handler from parent modal
 */
export default function PoolCreationOverlay({
  visible,
  onClose,
  theme,
  darkModeType,
  handleBackPressFunction,
}) {
  const { backgroundColor } = GetThemeColors();
  const { bottomPadding } = useGlobalInsets();

  const {
    currentStep,
    goalAmount,
    setGoalAmount,
    setCurrentStep,
    amountStyle,
    descStyle,
  } = usePoolCreationFlow({
    onComplete: onClose,
    onCancel: onClose,
  });

  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    overlayOpacity.value = withTiming(visible ? 1 : 0, { duration: 250 });
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  // Handle Android back button
  const handleBackPress = useCallback(() => {
    if (!visible) return false;

    if (currentStep === 'description') {
      // On description step, go back to amount step
      setCurrentStep('amount');
      return true;
    } else {
      // On amount step, close the overlay
      onClose();
      return true;
    }
  }, [visible, currentStep, setCurrentStep, onClose]);

  useHandleBackPressNew(handleBackPress);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, overlayStyle, { backgroundColor }]}
    >
      {/* Amount Step */}
      {currentStep !== 'description' && (
        <Animated.View
          style={[
            styles.stepContainer,
            amountStyle,
            { paddingBottom: bottomPadding },
          ]}
        >
          <PoolAmountInput
            onContinue={amount => {
              setGoalAmount(amount);
              setCurrentStep('description');
            }}
            onBack={onClose}
          />
        </Animated.View>
      )}

      {/* Description Step */}
      {currentStep === 'description' && (
        <Animated.View style={[styles.stepContainer, descStyle]}>
          <PoolDescriptionInput
            handleBackPressFunction={handleBackPressFunction}
            goalAmount={goalAmount}
            onCreatePool={poolData => {
              // Pool created, close overlay
              onClose();
            }}
            onBack={() => setCurrentStep('amount')}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  stepContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
