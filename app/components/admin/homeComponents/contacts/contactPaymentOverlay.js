import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import LottieView from 'lottie-react-native';

import { CENTER, SIZES } from '../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import GetThemeColors from '../../../../hooks/themeColors';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import ContactAmountEntry from './internalComponents/contactAmountEntry';
import useContactPayment from './hooks/useContactPayment';
import { useAppStatus } from '../../../../../context-store/appStatus';
import CurrencySwitchButton from '../../../../functions/CustomElements/currencySwitchButton';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import { updateConfirmAnimation } from '../../../../functions/lottieViewColorTransformer';

const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

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

  // Snapshot of the just-submitted request, captured at submit time so the
  // confirmation view keeps showing the right amount even if the payment hook's
  // state changes afterwards. null = still on the amount-entry step.
  const [successData, setSuccessData] = useState(null);

  const overlayOpacity = useSharedValue(0);
  const entryOpacity = useSharedValue(1);
  const entryTranslateX = useSharedValue(0);
  const successOpacity = useSharedValue(0);
  const successTranslateX = useSharedValue(30);

  useEffect(() => {
    overlayOpacity.value = withTiming(visible ? 1 : 0, { duration: 250 });
  }, [visible]);

  // Cross-fade between the amount-entry step and the confirmation step.
  useEffect(() => {
    const showingSuccess = successData !== null;
    entryOpacity.value = withTiming(showingSuccess ? 0 : 1, { duration: 250 });
    entryTranslateX.value = withTiming(showingSuccess ? -30 : 0, {
      duration: 250,
    });
    successOpacity.value = withTiming(showingSuccess ? 1 : 0, {
      duration: 250,
    });
    successTranslateX.value = withTiming(showingSuccess ? 0 : 30, {
      duration: 250,
    });
  }, [successData]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  const entryStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.value,
    transform: [{ translateX: entryTranslateX.value }],
  }));

  const successStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ translateX: successTranslateX.value }],
  }));

  const confirmAnimation = useMemo(
    () =>
      updateConfirmAnimation(
        confirmTxAnimation,
        theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
      ),
    [theme, darkModeType],
  );

  const handleBackPress = useCallback(() => {
    if (!visible) return false;
    // Once the request has been sent there's nothing to step back to — close
    // the whole modal, matching the Done button.
    if (successData !== null) {
      handleBackPressFunction();
      return true;
    }
    onClose();
    return true;
  }, [onClose, visible, successData, handleBackPressFunction]);

  const openCurrencyPicker = useCallback(
    () =>
      navigate.push('CustomHalfModal', {
        wantedContent: 'displayCurrencySelect',
        sliderHight: 0.6,
        currentCurrency: payment.displayCurrency,
        onSelectCurrency: payment.handleDisplayCurrencySelect,
      }),
    [navigate, payment.displayCurrency, payment.handleDisplayCurrencySelect],
  );

  useEffect(() => {
    if (!visible) return;
    setContentHeight(screenDimensions.height);
    setBackNav?.({
      onPress: handleBackPress,
      title: '',
      // The currency switcher is meaningless on the confirmation step.
      rightElement:
        successData !== null ? null : (
          <CurrencySwitchButton
            displayCurrency={payment.displayCurrency}
            onPress={openCurrencyPicker}
            disabled={payment.isResolvingDisplayCurrency}
          />
        ),
    });
    return () => {
      setBackNav?.(null);
      setContentHeight(Math.round(screenDimensions.height * 0.8));
    };
  }, [
    handleBackPress,
    setBackNav,
    visible,
    successData,
    payment.displayCurrency,
    payment.isResolvingDisplayCurrency,
    openCurrencyPicker,
  ]);

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
    // Replace the entry screen with an in-place confirmation instead of closing
    // straight to the homepage, so the user gets clear feedback the request
    // actually went through.
    setSuccessData({
      amountValue: payment.amountValue,
      denomination: payment.primaryDisplay.denomination,
      forceCurrency: payment.primaryDisplay.forceCurrency,
      forceFiatStats: payment.primaryDisplay.forceFiatStats,
      contactName: selectedContact?.name || selectedContact?.uniqueName || '',
    });
  }, [
    handleBackPressFunction,
    navigate,
    payment,
    paymentType,
    selectedContact,
  ]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, overlayStyle]}>
      <Animated.View
        style={[
          styles.stepContainer,
          entryStyle,
          { paddingBottom: bottomPadding },
        ]}
        pointerEvents={successData !== null ? 'none' : 'auto'}
      >
        <ContactAmountEntry
          selectedContact={selectedContact}
          imageData={imageData}
          amountValue={payment.amountValue}
          setAmountValue={payment.setAmountValue}
          primaryDisplay={payment.primaryDisplay}
          conversionFiatStats={payment.conversionFiatStats}
          canReview={payment.canReview}
          isLoading={payment.isLoading}
          onNext={handleSubmit}
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
          isResolvingDisplayCurrency={payment.isResolvingDisplayCurrency}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.stepContainer,
          styles.successContainer,
          successStyle,
          { paddingBottom: bottomPadding },
        ]}
        pointerEvents={successData !== null ? 'auto' : 'none'}
      >
        <View style={styles.successContent}>
          {successData !== null && (
            <LottieView
              source={confirmAnimation}
              loop={false}
              autoPlay
              style={styles.lottie}
            />
          )}
          <ThemeText
            CustomNumberOfLines={2}
            styles={styles.successSubtitle}
            content={t('wallet.halfModal.requestSentSubtitle', {
              name: successData?.contactName,
            })}
          />
        </View>
        <CustomButton
          buttonStyles={styles.doneButton}
          actionFunction={handleBackPressFunction}
          textContent={t('constants.done')}
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
  successContainer: {
    alignItems: 'center',
  },
  successContent: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    // justifyContent: 'center',
  },
  lottie: {
    width: 200,
    height: 200,
    marginBottom: 8,
  },

  successSubtitle: {
    fontSize: SIZES.medium,
    // opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    // marginTop: 20,
    includeFontPadding: false,
  },
  doneButton: {
    // width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
});
