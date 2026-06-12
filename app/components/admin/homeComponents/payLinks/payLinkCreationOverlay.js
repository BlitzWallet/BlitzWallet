import { useEffect, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import PayLinkAmountInput from './components/payLinkAmountInput';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { useNavigation } from '@react-navigation/native';
import customUUID from '../../../../functions/customUUID';

/**
 * PayLink Creation Overlay Component
 * Used inside HalfModalReceiveOptions to enter an amount and jump to the QR page
 *
 * @param {Boolean} visible - Controls overlay visibility
 * @param {Function} onClose - Callback when overlay should close
 */
export default function PayLinkCreationOverlay({ visible, onClose, setBackNav }) {
  const { bottomPadding } = useGlobalInsets();
  const { masterInfoObject } = useGlobalContextProvider();
  const navigate = useNavigation();
  const currencyType =
    masterInfoObject.lnurlReceiveCurrency?.toLowerCase() === 'usd'
      ? 'USD'
      : 'BTC';

  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    overlayOpacity.value = withTiming(visible ? 1 : 0, { duration: 250 });
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  const navigateToReceive = useCallback(
    amount => {
      onClose();
      navigate.replace('ReceiveBTC', {
        from: 'homepage',
        ...(currencyType === 'BTC'
          ? { initialReceiveType: 'BTC', selectedRecieveOption: 'lightning' }
          : { endReceiveType: 'USD', uuid: customUUID() }),
        ...(amount ? { receiveAmount: amount } : {}),
      });
    },
    [onClose, navigate, currencyType],
  );

  const handleBackPress = useCallback(() => {
    if (!visible) return false;
    onClose();
    return true;
  }, [visible, onClose]);

  useHandleBackPressNew(handleBackPress);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, overlayStyle]}>
      <View style={[styles.stepContainer, { paddingBottom: bottomPadding }]}>
        <PayLinkAmountInput
          paymentMode={currencyType}
          onContinue={amount => navigateToReceive(amount)}
          onSkip={() => navigateToReceive(undefined)}
          onBack={onClose}
          setBackNav={setBackNav}
          onHeaderBack={handleBackPress}
        />
      </View>
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
