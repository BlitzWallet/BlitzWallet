import { useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import GetThemeColors from '../../../../hooks/themeColors';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import ContactAmountEntry from './internalComponents/contactAmountEntry';
import useContactPayment from './hooks/useContactPayment';
import { useAppStatus } from '../../../../../context-store/appStatus';

export default function ContactPaymentOverlay({
  visible,
  onClose,
  paymentType,
  selectedContact,
  imageData,
  selectedMethod,
  handleBackPressFunction,
  setBackNav,
  navigate,
  theme,
  darkModeType,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const { bottomPadding } = useGlobalInsets();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { screenDimensions } = useAppStatus();
  const payment = useContactPayment({
    selectedContact,
    paymentType,
    imageData,
    selectedPaymentMethod: paymentType === 'send' ? selectedMethod : undefined,
    selectedRequestMethod:
      paymentType === 'request' ? selectedMethod : undefined,
    t,
  });

  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    overlayOpacity.value = withTiming(visible ? 1 : 0, { duration: 250 });
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  const handleBackPress = useCallback(() => {
    if (!visible) return false;
    onClose();
    return true;
  }, [onClose, visible]);

  useEffect(() => {
    if (!visible) return;
    setContentHeight(screenDimensions.height);
    setBackNav?.({
      onPress: handleBackPress,
      title: '',
    });
    return () => {
      setBackNav?.(null);
      setContentHeight(Math.round(screenDimensions.height * 0.8));
    };
  }, [handleBackPress, setBackNav, visible]);

  useHandleBackPressNew(handleBackPress);

  const handleSelectPaymentMethod = useCallback(() => {
    if (paymentType === 'send') {
      navigate.push('CustomHalfModal', {
        wantedContent: 'SelectPaymentMethod',
        selectedPaymentMethod: payment.paymentMethod,
        onSelectMethod: payment.setSelectedPaymentMethod,
      });
    } else {
      navigate.push('CustomHalfModal', {
        wantedContent: 'SelectContactRequestCurrency',
        selectedRecieveOption: payment.paymentMethod,
        onSelectMethod: payment.setSelectedPaymentMethod,
      });
    }
  }, [
    navigate,
    payment.paymentMethod,
    payment.setSelectedPaymentMethod,
    paymentType,
  ]);

  const handleSubmit = useCallback(async () => {
    if (paymentType === 'send') {
      const result = await payment.buildSendHandoff();
      if (!result.didWork) {
        navigate.navigate('ErrorScreen', {
          errorMessage: result.errorMessage,
          useTranslationString: result.useTranslationString,
        });
        return;
      }

      handleBackPressFunction(() => {
        navigate.replace('ConfirmPaymentScreen', result.params);
      });
      return;
    }

    const result = await payment.submitRequest();
    if (!result.didWork) {
      navigate.navigate('ErrorScreen', {
        errorMessage: result.errorMessage,
        useTranslationString: result.useTranslationString,
      });
      return;
    }
    handleBackPressFunction();
  }, [handleBackPressFunction, navigate, payment, paymentType]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, overlayStyle]}>
      <Animated.View
        style={[styles.stepContainer, { paddingBottom: bottomPadding }]}
      >
        <ContactAmountEntry
          selectedContact={selectedContact}
          imageData={imageData}
          amountValue={payment.amountValue}
          setAmountValue={payment.setAmountValue}
          primaryDisplay={payment.primaryDisplay}
          secondaryDisplay={payment.secondaryDisplay}
          conversionFiatStats={payment.conversionFiatStats}
          convertedSendAmount={payment.convertedSendAmount}
          canReview={payment.canReview}
          isLoading={payment.isLoading}
          onNext={handleSubmit}
          onToggleDenomination={payment.handleDenominationToggle}
          paymentMethod={payment.paymentMethod}
          onSelectPaymentMethod={handleSelectPaymentMethod}
          bitcoinBalance={payment.balances.sparkBalance}
          dollarBalanceToken={payment.balances.dollarBalanceToken}
          masterInfoObject={payment.masterInfoObject}
          fiatStats={payment.fiatStats}
          theme={theme}
          darkModeType={darkModeType}
          backgroundColor={backgroundColor}
          backgroundOffset={backgroundOffset}
          t={t}
          paymentType={paymentType}
        />
      </Animated.View>
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
