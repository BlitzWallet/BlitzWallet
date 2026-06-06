import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ThemeText } from '../../../../functions/CustomElements';
import { CENTER, SIZES } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { sparkPaymenWrapper } from '../../../../functions/spark/payments';
import { addContributionWithTransaction } from '../../../../../db';
import { v4 as uuidv4 } from 'uuid';
import PresetAmountGrid from './presetAmountGrid';
import CustomButton from '../../../../functions/CustomElements/button';
import SwipeButtonNew from '../../../../functions/CustomElements/sliderButton';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { updateConfirmAnimation } from '../../../../functions/lottieViewColorTransformer';
import LottieView from 'lottie-react-native';
import { useGlobalContactsInfo } from '../../../../../context-store/globalContacts';
import { Timestamp } from '@react-native-firebase/firestore';
import { saveContributionLocal } from '../../../../functions/pools/poolsStorage';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import { useWebView } from '../../../../../context-store/webViewContext';
import { validatePoolPayment } from './poolPaymentValidation';
import {
  BTC_ASSET_ADDRESS,
  dollarsToSats,
  satsToDollars,
  USD_ASSET_ADDRESS,
} from '../../../../functions/spark/swapAmountUtils';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import { simulateSwap } from '../../../../functions/spark/flashnet';

const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

const STEP_ORDER = ['select', 'custom', 'confirm', 'loading', 'success'];

export default function ContributeToPoolHalfModal({
  pool,
  poolId,
  setContentHeight,
  handleBackPressFunction,
  setBackNav,
}) {
  const navigate = useNavigation();
  const { bitcoinBalance, dollarBalanceSat, dollarBalanceToken } =
    useUserBalanceContext();
  const { sendWebViewRequest } = useWebView();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { sparkInformation } = useSparkWallet();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { poolInfoRef, swapUSDPriceDollars, swapLimits } = useFlashnet();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  // Step can be 'select', 'custom', 'confirm', 'loading', 'success'
  const [step, setStep] = useState(['select']);
  const [selectedAmountSats, setSelectedAmountSats] = useState(0);
  const [amountValue, setAmountValue] = useState('');
  const [inputDenomination, setInputDenomination] = useState(
    masterInfoObject.userBalanceDenomination !== 'fiat' ? 'sats' : 'fiat',
  );
  // extract current page for easier handling
  const currentPage = step[step.length - 1];
  const previousPageRef = useRef(currentPage);

  const selectOpacity = useSharedValue(1);
  const selectTranslateX = useSharedValue(0);
  const customOpacity = useSharedValue(0);
  const customTranslateX = useSharedValue(30);
  const confirmOpacity = useSharedValue(0);
  const confirmTranslateX = useSharedValue(30);
  const loadingOpacity = useSharedValue(0);
  const loadingTranslateX = useSharedValue(30);
  const successOpacity = useSharedValue(0);
  const successTranslateX = useSharedValue(30);

  const getStepAnimation = useCallback(
    page => {
      switch (page) {
        case 'custom':
          return { opacity: customOpacity, translateX: customTranslateX };
        case 'confirm':
          return { opacity: confirmOpacity, translateX: confirmTranslateX };
        case 'loading':
          return { opacity: loadingOpacity, translateX: loadingTranslateX };
        case 'success':
          return { opacity: successOpacity, translateX: successTranslateX };
        case 'select':
        default:
          return { opacity: selectOpacity, translateX: selectTranslateX };
      }
    },
    [
      confirmOpacity,
      confirmTranslateX,
      customOpacity,
      customTranslateX,
      loadingOpacity,
      loadingTranslateX,
      selectOpacity,
      selectTranslateX,
      successOpacity,
      successTranslateX,
    ],
  );

  useEffect(() => {
    const previousPage = previousPageRef.current;
    if (previousPage === currentPage) return;

    const previousIndex = STEP_ORDER.indexOf(previousPage);
    const currentIndex = STEP_ORDER.indexOf(currentPage);
    const isForward = currentIndex > previousIndex;
    const previousAnimation = getStepAnimation(previousPage);
    const currentAnimation = getStepAnimation(currentPage);

    previousAnimation.opacity.value = withTiming(0, { duration: 250 });
    previousAnimation.translateX.value = withTiming(isForward ? -30 : 30, {
      duration: 250,
    });

    currentAnimation.opacity.value = 0;
    currentAnimation.translateX.value = isForward ? 30 : -30;
    currentAnimation.opacity.value = withTiming(1, { duration: 250 });
    currentAnimation.translateX.value = withTiming(0, { duration: 250 });

    previousPageRef.current = currentPage;
  }, [currentPage, getStepAnimation]);

  const selectAnimatedStyle = useAnimatedStyle(() => ({
    opacity: selectOpacity.value,
    transform: [{ translateX: selectTranslateX.value }],
  }));

  const customAnimatedStyle = useAnimatedStyle(() => ({
    opacity: customOpacity.value,
    transform: [{ translateX: customTranslateX.value }],
  }));

  const confirmAnimatedStyle = useAnimatedStyle(() => ({
    opacity: confirmOpacity.value,
    transform: [{ translateX: confirmTranslateX.value }],
  }));

  const loadingAnimatedStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
    transform: [{ translateX: loadingTranslateX.value }],
  }));

  const successAnimatedStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ translateX: successTranslateX.value }],
  }));

  const normalizedInputDenomination = inputDenomination
    ? inputDenomination
    : masterInfoObject.userBalanceDenomination !== 'fiat'
    ? 'sats'
    : 'fiat';

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
    convertSatsToDisplay,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
    paymentMode: 'BTC',
    inputDenomination: normalizedInputDenomination,
    fiatStats,
    usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
    masterInfoObject,
  });

  // clear page specific states when going back
  const clearPageStates = useCallback(() => {
    setSelectedAmountSats(0);
    setAmountValue('');
  }, []);

  // Handle Android back button with multi-step logic
  const handleBackPress = useCallback(() => {
    if (currentPage === 'success') {
      // On success page, allow default back behavior to close the modal
      return false;
    } else if (currentPage === 'loading') {
      // block actions on loading screen
      return true;
    } else if (step.length > 1) {
      // On select or custom page, go back to the previous step
      setStep(step.slice(0, -1));
      clearPageStates();
      return true;
    } else {
      // If select page, allow default back behavior to close the modal
      return false;
    }
  }, [step, currentPage, setStep, clearPageStates]);

  useHandleBackPressNew(handleBackPress);

  // Register the chrome's back arrow whenever a previous step exists.
  useEffect(() => {
    if (
      step.length > 1 &&
      currentPage !== 'loading' &&
      currentPage !== 'success'
    ) {
      setBackNav?.({ onPress: handleBackPress, title: '' });
    } else {
      setBackNav?.(null);
    }
    return () => setBackNav?.(null);
  }, [step, currentPage, handleBackPress, setBackNav]);

  const isFiatMode = masterInfoObject.userBalanceDenomination === 'fiat';

  // Convert current keyboard input to sats (used only in custom step)
  const localSatAmount = convertDisplayToSats(amountValue);
  const effectiveSats =
    currentPage === 'custom' ? localSatAmount : selectedAmountSats;

  const effectiveUSD = satsToDollars(
    effectiveSats,
    poolInfoRef.currentPriceAInB,
  );

  const handleDenominationToggle = () => {
    const nextDenom = getNextDenomination();
    setInputDenomination(nextDenom);
    setAmountValue(convertForToggle(amountValue, convertTextInputValue));
  };

  useEffect(() => {
    setContentHeight(550);
  }, []);

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  const handleCustomPress = useCallback(() => {
    setStep([...step, 'custom']);
    setSelectedAmountSats(0);
  }, [step]);

  const paymentMethod = useMemo(() => {
    if (bitcoinBalance >= effectiveSats) {
      return 'BTC';
    }
    if (dollarBalanceToken >= effectiveUSD && effectiveUSD >= swapLimits.usd) {
      return 'USD';
    }
    return null;
  }, [bitcoinBalance, dollarBalanceToken, effectiveSats, effectiveUSD]);

  const handleContinue = useCallback(() => {
    if (currentPage === 'custom') {
      if (effectiveSats <= 0) {
        setStep(['select']);
        clearPageStates();
        return;
      }
      setSelectedAmountSats(effectiveSats);
    }
    if (currentPage === 'select' && !selectedAmountSats) return;

    const validation = validatePoolPayment({
      bitcoinBalance,
      dollarBalanceToken,
      paymentAmountSats: effectiveSats,
      paymentAmountUSD: effectiveUSD,
      swapLimits,
    });

    if (!validation.isValid) {
      const errorMessage =
        validation.errorReason === 'BELOW_USD_SWAP_MINIMUM'
          ? t('wallet.sendPages.acceptButton.swapMinimumError', {
              amount: displayCorrectDenomination({
                amount:
                  dollarsToSats(swapLimits.usd, poolInfoRef.currentPriceAInB) +
                  10,
                masterInfoObject: {
                  ...masterInfoObject,
                  userBalanceDenomination: inputDenomination,
                },
                fiatStats: conversionFiatStats,
                forceCurrency: primaryDisplay.forceCurrency,
              }),
              currency1: t('constants.dollars_upper'),
              currency2: t('constants.bitcoin_upper'),
            })
          : t('wallet.sendPages.acceptButton.balanceError');
      navigate.navigate('ErrorScreen', { errorMessage });
      return;
    }

    setStep([...step, 'confirm']);
  }, [
    currentPage,
    effectiveSats,
    effectiveUSD,
    selectedAmountSats,
    bitcoinBalance,
    dollarBalanceToken,
    step,
    clearPageStates,
    t,
    swapLimits,
  ]);

  const handleConfirmPayment = useCallback(async () => {
    try {
      setStep([...step, 'loading']);
      const paymentAmountSats = effectiveSats;
      const paymentAmountUSD = effectiveUSD;

      let swapPaymentQuote = {};

      if (paymentMethod === 'USD') {
        const amountToSendDollars = paymentAmountUSD * Math.pow(10, 6);
        const usdBalanceDollars = dollarBalanceToken * Math.pow(10, 6);

        const maxAmount = Math.min(amountToSendDollars, usdBalanceDollars);
        const usdAmount = Math.ceil(parseFloat(maxAmount.toFixed(2)));

        const simResult = await simulateSwap(currentWalletMnemoinc, {
          poolId: poolInfoRef.lpPublicKey,
          assetInAddress: USD_ASSET_ADDRESS,
          assetOutAddress: BTC_ASSET_ADDRESS,
          amountIn: usdAmount,
        });

        if (!simResult.didWork) {
          throw new Error(simResult.error || 'Swap simulation failed');
        }

        const satFee = dollarsToSats(
          simResult.simulation.feePaidAssetIn / 1000000,
          poolInfoRef.currentPriceAInB,
        );

        swapPaymentQuote = {
          poolId: poolInfoRef.lpPublicKey,
          assetInAddress: USD_ASSET_ADDRESS,
          assetOutAddress: BTC_ASSET_ADDRESS,
          amountIn: usdAmount,
          satFee,
          bitcoinBalance,
          dollarBalanceSat,
        };
      }

      const paymentResponse = await sparkPaymenWrapper({
        address: pool.sparkAddress,
        paymentType: 'spark',
        amountSats: paymentAmountSats,
        masterInfoObject,
        memo: t('wallet.pools.pool_contribution_label', {
          poolName: pool.poolTitle,
        }),
        userBalance: sparkInformation.userBalance,
        sparkInformation,
        mnemonic: currentWalletMnemoinc,
        sendWebViewRequest,
        poolInfoRef,
        usablePaymentMethod: paymentMethod,
        swapPaymentQuote,
        extraDetails: { isPoolPayment: true },
      });

      if (!paymentResponse.didWork) {
        throw new Error(paymentResponse.error || 'Payment failed');
      }

      const actualAmountSats = paymentResponse.response.details.amount;

      const creatorProfile = globalContactsInformation?.myProfile || {};
      const contribution = {
        contributionId: uuidv4(),
        poolId,
        contributorName:
          creatorProfile.name || creatorProfile.uniqueName || 'Blitz User',
        contributorMessage: '',
        amount: paymentResponse.amountOutSats ?? actualAmountSats,
        isBlitzUser: true,
        blitzUserUUID: masterInfoObject.uuid,
        createdAt: Timestamp.now(),
      };

      await addContributionWithTransaction(
        poolId,
        contribution,
        paymentAmountSats,
      );

      await saveContributionLocal(contribution);

      setStep([...step, 'success']);
    } catch (err) {
      console.log('Error contributing to pool:', err);
      handleBackPressFunction(() => {
        navigate.replace('ErrorScreen', { errorMessage: err.message });
      });
    }
  }, [
    effectiveSats,
    effectiveUSD,
    pool,
    poolId,
    masterInfoObject,
    sparkInformation,
    currentWalletMnemoinc,
    navigate,
    poolInfoRef,
    handleBackPressFunction,
    dollarBalanceToken,
  ]);

  const displayAmount = isFiatMode
    ? convertSatsToDisplay(effectiveSats)
    : effectiveSats;
  const stepBackgroundStyle = {
    backgroundColor: theme && darkModeType ? backgroundOffset : backgroundColor,
  };
  const layerChrome = page => ({
    zIndex: currentPage === page ? 2 : 1,
  });
  const layerPointerEvents = page => (currentPage === page ? 'auto' : 'none');

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.stepContainer,
          stepBackgroundStyle,
          selectAnimatedStyle,
          layerChrome('select'),
        ]}
        pointerEvents={layerPointerEvents('select')}
      >
        <ThemeText
          styles={styles.selectTitle}
          content={t('wallet.pools.chooseContributionAmount')}
        />

        <PresetAmountGrid
          onSelectPreset={setSelectedAmountSats}
          selectedAmountSats={selectedAmountSats}
          fiatStats={fiatStats}
          onCustomPress={handleCustomPress}
        />

        <CustomButton
          buttonStyles={[
            styles.continueButton,
            { opacity: !selectedAmountSats ? HIDDEN_OPACITY : 1 },
          ]}
          textContent={t('constants.continue')}
          actionFunction={handleContinue}
        />
      </Animated.View>

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.stepContainer,
          stepBackgroundStyle,
          customAnimatedStyle,
          layerChrome('custom'),
        ]}
        pointerEvents={layerPointerEvents('custom')}
      >
        <TouchableOpacity
          style={{ marginTop: 10 }}
          activeOpacity={1}
          onPress={handleDenominationToggle}
        >
          <FormattedBalanceInput
            maxWidth={0.9}
            amountValue={amountValue}
            inputDenomination={primaryDisplay.denomination}
            forceCurrency={primaryDisplay.forceCurrency}
            forceFiatStats={primaryDisplay.forceFiatStats}
          />
          <FormattedSatText
            containerStyles={{ opacity: !amountValue ? HIDDEN_OPACITY : 1 }}
            neverHideBalance={true}
            styles={{ includeFontPadding: false, ...styles.satValue }}
            globalBalanceDenomination={secondaryDisplay.denomination}
            forceCurrency={secondaryDisplay.forceCurrency}
            forceFiatStats={secondaryDisplay.forceFiatStats}
            balance={localSatAmount}
          />
        </TouchableOpacity>
        <CustomNumberKeyboard
          showDot={inputDenomination === 'fiat'}
          setInputValue={setAmountValue}
          usingForBalance={true}
          fiatStats={fiatStats}
        />
        <CustomButton
          buttonStyles={{ ...CENTER, marginTop: 10 }}
          actionFunction={handleContinue}
          textContent={
            Number(amountValue) ? t('constants.continue') : t('constants.back')
          }
        />
      </Animated.View>

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.stepContainer,
          stepBackgroundStyle,
          confirmAnimatedStyle,
          layerChrome('confirm'),
        ]}
        pointerEvents={layerPointerEvents('confirm')}
      >
        <FormattedBalanceInput
          maxWidth={0.9}
          amountValue={displayAmount}
          inputDenomination={isFiatMode ? 'fiat' : 'sats'}
        />
        <ThemeText
          styles={styles.confirmPoolTitle}
          content={`${t('wallet.pools.contributeTo')}${pool.poolTitle}`}
        />

        <ThemeText
          styles={styles.infoItem}
          content={t('wallet.pools.contributionWarning')}
        />

        <SwipeButtonNew
          onSwipeSuccess={handleConfirmPayment}
          width={0.9}
          containerStyles={{ marginBottom: 12 }}
          thumbIconStyles={{
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
            borderColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          }}
          railStyles={{
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
            borderColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          }}
        />
      </Animated.View>

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.stepContainer,
          stepBackgroundStyle,
          loadingAnimatedStyle,
          layerChrome('loading'),
        ]}
        pointerEvents={layerPointerEvents('loading')}
      >
        <FullLoadingScreen text={t('wallet.pools.sendingContribution')} />
      </Animated.View>

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.stepContainer,
          styles.successContainer,
          stepBackgroundStyle,
          successAnimatedStyle,
          layerChrome('success'),
        ]}
        pointerEvents={layerPointerEvents('success')}
      >
        {currentPage === 'success' && (
          <LottieView
            source={confirmAnimation}
            loop={false}
            style={styles.lottieView}
            autoPlay={true}
          />
        )}
        <ThemeText
          styles={styles.successText}
          content={t('wallet.pools.contributionSent')}
        />
        <CustomButton
          actionFunction={handleBackPressFunction}
          textContent={t('constants.back')}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  selectTitle: {
    fontSize: SIZES.xLarge,
    marginBottom: 24,
  },
  selectedAmountText: {
    fontSize: SIZES.xxLarge,
    textAlign: 'center',
    marginTop: 24,
  },
  continueButton: {
    ...CENTER,
    marginTop: 'auto',
  },
  confirmAmount: {
    fontSize: SIZES.huge,
    textAlign: 'center',
    marginTop: 10,
    includeFontPadding: false,
  },
  lottieView: {
    width: 125,
    height: 125,
  },
  confirmPoolTitle: {
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 24,
    includeFontPadding: false,
  },

  infoItem: {
    marginTop: 'auto',
    fontSize: SIZES.small,
    opacity: 0.7,
    textAlign: 'center',
    includeFontPadding: false,
    marginBottom: 15,
  },
  successContainer: {
    alignItems: 'center',
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  successText: {
    fontSize: SIZES.xLarge,
    includeFontPadding: false,
    marginBottom: 'auto',
  },
  successAmount: {
    fontSize: SIZES.large,
    opacity: 0.7,
  },
  satValue: {
    textAlign: 'center',
    marginBottom: 50,
  },
});
