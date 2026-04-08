import { useEffect, useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { usePayLinkCreationFlow } from './payLinkCreationSharedLogic';
import PayLinkAmountInput from './components/payLinkAmountInput';
import PayLinkDescriptionInput from './components/payLinkDescriptionInput';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { useNavigation } from '@react-navigation/native';
import customUUID from '../../../../functions/customUUID';

/**
 * PayLink Creation Overlay Component
 * Used inside HalfModalReceiveOptions to create paylinks without opening a new modal
 *
 * @param {Boolean} visible - Controls overlay visibility
 * @param {Function} onClose - Callback when overlay should close
 * @param {Object} theme - Theme object
 * @param {Boolean} darkModeType - Dark mode flag
 * @param {Function} handleBackPressFunction - Back press handler from parent modal
 */
export default function PayLinkCreationOverlay({
  visible,
  onClose,
  theme,
  darkModeType,
  handleBackPressFunction,
  setContentHeight,
}) {
  const { bottomPadding } = useGlobalInsets();
  const navigate = useNavigation();
  const [didCreatePaylink, setDidCreatePaylink] = useState('');
  const [currencyType, setCurrencyType] = useState('BTC');

  const {
    currentStep,
    payLinkAmount,
    setPayLinkAmount,
    setCurrentStep,
    amountStyle,
    descStyle,
  } = usePayLinkCreationFlow({
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

  const handleSkip = useCallback(
    (amount, description) => {
      onClose();
      navigate.replace('ReceiveBTC', {
        from: 'homepage',
        ...(currencyType === 'BTC'
          ? { initialReceiveType: 'BTC', selectedRecieveOption: 'lightning' }
          : { endReceiveType: 'USD', uuid: customUUID() }),
        ...(amount ? { receiveAmount: amount } : {}),
        ...(description ? { description: description } : {}),
      });
    },
    [onClose, navigate, currencyType],
  );

  const handleBackPress = useCallback(() => {
    if (!visible) return false;

    if (currentStep === 'description') {
      if (didCreatePaylink) {
        handleBackPressFunction?.();
        return true;
      } else {
        setCurrentStep('amount');
        return true;
      }
    } else {
      onClose();
      return true;
    }
  }, [
    visible,
    currentStep,
    setCurrentStep,
    onClose,
    didCreatePaylink,
    handleBackPressFunction,
  ]);

  useHandleBackPressNew(handleBackPress);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, overlayStyle]}>
      {/* Amount Step */}
      {currentStep !== 'description' && (
        <Animated.View
          style={[
            styles.stepContainer,
            amountStyle,
            { paddingBottom: bottomPadding },
          ]}
        >
          <PayLinkAmountInput
            paymentMode={currencyType}
            onSelectCurrency={setCurrencyType}
            onContinue={(amount, rawAmount) => {
              setPayLinkAmount({ amount, rawAmount });
              setCurrentStep('description');
            }}
            onSkip={() => handleSkip(undefined, undefined)}
            onBack={onClose}
          />
        </Animated.View>
      )}

      {/* Description Step */}
      {currentStep === 'description' && (
        <Animated.View style={[styles.stepContainer, descStyle]}>
          <PayLinkDescriptionInput
            currencyType={currencyType}
            payLinkAmount={payLinkAmount}
            onComplete={handleBackPressFunction}
            onBack={() => setCurrentStep('amount')}
            onSkip={(amount, description) => handleSkip(amount, description)}
            setContentHeight={setContentHeight}
            setDidCreatePaylink={setDidCreatePaylink}
            didCreatePaylink={didCreatePaylink}
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
