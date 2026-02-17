import { useEffect, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePoolCreationFlow } from './poolCreationSharedLogic';
import PoolAmountInput from './components/poolAmountInput';
import PoolDescriptionInput from './components/poolDescriptionInput';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';

/**
 * Create Pool Flow Component
 * Used as CustomHalfModal content for settings path
 * Provides multi-step pool creation (amount → description)
 *
 * @param {Object} route - Navigation route params
 * @param {Function} setContentHeight - Callback to adjust modal height
 * @param {Function} handleBackPressFunction - Back press handler from modal
 * @param {Object} navigate - Navigation object
 */
export default function CreatePoolFlow({
  route,
  setContentHeight,
  handleBackPressFunction,
  navigate,
}) {
  const { bottomPadding } = useGlobalInsets();

  const {
    currentStep,
    goalAmount,
    setGoalAmount,
    setCurrentStep,
    amountStyle,
    descStyle,
  } = usePoolCreationFlow({
    onComplete: () => navigate.goBack(),
    onCancel: () => navigate.goBack(),
  });

  useEffect(() => {
    const height = currentStep === 'description' ? 400 : 600; // Adjust height based on step
    setContentHeight?.(height);
  }, [currentStep, setContentHeight]);

  // Handle Android back button with multi-step logic
  const handleBackPress = useCallback(() => {
    if (currentStep === 'description') {
      // On description step, go back to amount step
      setCurrentStep('amount');
      return true;
    } else {
      // On amount step, close the modal (let parent handle it)
      return false;
    }
  }, [currentStep, setCurrentStep]);

  useHandleBackPressNew(handleBackPress);

  return (
    <View style={styles.container}>
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
            onBack={handleBackPressFunction}
          />
        </Animated.View>
      )}
      {/* Description Step */}
      {currentStep === 'description' && (
        <Animated.View style={[styles.stepContainer, descStyle]}>
          <PoolDescriptionInput
            goalAmount={goalAmount}
            onCreatePool={poolData => {
              // Pool created via handleBackPressFunction in PoolDescriptionInput
            }}
            onBack={() => setCurrentStep('amount')}
            handleBackPressFunction={handleBackPressFunction}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
