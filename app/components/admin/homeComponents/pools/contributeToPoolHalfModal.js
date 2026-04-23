import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { CENTER, SIZES, SATSPERBITCOIN } from '../../../../constants';
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
import { usePools } from '../../../../../context-store/poolContext';
import { Timestamp } from '@react-native-firebase/firestore';
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

export default function ContributeToPoolHalfModal({
  pool,
  poolId,
  setContentHeight,
  handleBackPressFunction,
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
  const { poolInfoRef, swapUSDPriceDollars } = useFlashnet();
  const { addContributionToCache } = usePools();
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

  const isFiatMode = masterInfoObject.userBalanceDenomination === 'fiat';

  // Convert current keyboard input to sats (used only in custom step)
  const localSatAmount = convertDisplayToSats(amountValue);
  const localFiatAmount = convertSatsToDisplay(localSatAmount);
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
    if (currentPage === 'select') {
      setContentHeight(500);
    } else if (
      currentPage === 'confirm' ||
      currentPage === 'loading' ||
      currentPage === 'success'
    ) {
      setContentHeight(500);
    } else {
      setContentHeight(550);
    }
  }, [currentPage]);

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
    if (dollarBalanceToken >= effectiveUSD) {
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
    });

    if (!validation.isValid) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.sendPages.acceptButton.balanceError'),
      });
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

      await addContributionToCache(contribution);

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

  if (currentPage === 'loading') {
    return (
      <View style={styles.stepContainer}>
        <FullLoadingScreen text={t('wallet.pools.sendingContribution')} />
      </View>
    );
  }

  if (currentPage === 'success') {
    return (
      <View style={[styles.stepContainer, styles.successContainer]}>
        <LottieView
          source={confirmAnimation}
          loop={false}
          style={styles.lottieView}
          autoPlay={true}
        />
        <ThemeText
          styles={styles.successText}
          content={t('wallet.pools.contributionSent')}
        />
        <CustomButton
          actionFunction={handleBackPressFunction}
          textContent={t('constants.back')}
        />
      </View>
    );
  }

  if (currentPage === 'confirm') {
    const displayAmount = isFiatMode ? localFiatAmount : effectiveSats;

    return (
      <View style={styles.stepContainer}>
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
          width={0.95}
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
      </View>
    );
  }

  if (currentPage === 'custom') {
    return (
      <View style={styles.stepContainer}>
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
      </View>
    );
  }

  // Step: 'select'
  return (
    <View style={styles.stepContainer}>
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
    </View>
  );
}

const styles = StyleSheet.create({
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
