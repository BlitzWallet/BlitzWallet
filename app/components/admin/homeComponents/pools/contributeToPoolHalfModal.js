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
import { useGlobalContacts } from '../../../../../context-store/globalContacts';
import { usePools } from '../../../../../context-store/poolContext';
import { Timestamp } from '@react-native-firebase/firestore';

const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

export default function ContributeToPoolHalfModal({
  pool,
  poolId,
  setContentHeight,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { globalContactsInformation } = useGlobalContacts();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { sparkInformation } = useSparkWallet();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { poolInfoRef } = useFlashnet();
  const { addContributionToCache } = usePools();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  const [step, setStep] = useState('select');
  // Store the full preset object or custom amount details
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [amountValue, setAmountValue] = useState('');
  const [inputDenomination, setInputDenomination] = useState(
    masterInfoObject.userBalanceDenomination !== 'fiat' ? 'sats' : 'fiat',
  );

  const isFiatMode = masterInfoObject.userBalanceDenomination === 'fiat';

  // Convert current input to sats
  const localSatAmount =
    inputDenomination === 'sats'
      ? Number(amountValue)
      : Math.round(
          (Number(amountValue) / (fiatStats?.value || 65000)) * SATSPERBITCOIN,
        );

  // Convert between denominations for display
  const convertedValue = () => {
    if (!amountValue) return '';

    if (inputDenomination === 'fiat') {
      // Convert fiat to sats
      return String(
        Math.round(
          (Number(amountValue) / (fiatStats?.value || 65000)) * SATSPERBITCOIN,
        ),
      );
    } else {
      // Convert sats to fiat
      return String(
        (
          ((fiatStats?.value || 65000) / SATSPERBITCOIN) *
          Number(amountValue)
        ).toFixed(2),
      );
    }
  };

  useEffect(() => {
    if (step === 'select') {
      setContentHeight(500);
    } else if (step === 'confirm' || step === 'loading' || step === 'success') {
      setContentHeight(500);
    } else {
      setContentHeight(550);
    }
  }, [step]);

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  const handleCustomPress = useCallback(() => {
    setStep('custom');
  }, []);

  const handleContinue = useCallback(() => {
    if (step === 'custom') {
      if (localSatAmount <= 0) return;
      // Create a custom preset object
      setSelectedPreset({
        usd: (
          ((fiatStats?.value || 65000) / SATSPERBITCOIN) *
          localSatAmount
        ).toFixed(2),
        sats: localSatAmount,
        satValueOfUsd: localSatAmount,
        isCustom: true,
      });
    }
    if (step === 'select' && !selectedPreset) return;
    setStep('confirm');
  }, [step, selectedPreset, localSatAmount, fiatStats]);

  const handleConfirmPayment = useCallback(async () => {
    try {
      setStep('loading');

      // Use the appropriate sats value based on user's denomination preference
      const paymentAmountSats = isFiatMode
        ? selectedPreset.satValueOfUsd
        : selectedPreset.sats;

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
        poolInfoRef,
      });

      if (!paymentResponse.didWork) {
        throw new Error(paymentResponse.error || 'Payment failed');
      }

      const creatorProfile = globalContactsInformation?.myProfile || {};
      const contribution = {
        contributionId: uuidv4(),
        poolId,
        contributorName:
          creatorProfile.name || creatorProfile.uniqueName || 'Blitz User',
        contributorMessage: '',
        amount: paymentAmountSats,
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

      setStep('success');
    } catch (err) {
      console.log('Error contributing to pool:', err);
      handleBackPressFunction(() => {
        navigate.replace('ErrorScreen', { errorMessage: err.message });
      });
    }
  }, [
    selectedPreset,
    isFiatMode,
    pool,
    poolId,
    masterInfoObject,
    sparkInformation,
    currentWalletMnemoinc,
    navigate,
    poolInfoRef,
    handleBackPressFunction,
  ]);

  if (step === 'loading') {
    return (
      <View style={styles.stepContainer}>
        <FullLoadingScreen text={t('wallet.pools.sendingContribution')} />
      </View>
    );
  }

  if (step === 'success') {
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

  if (step === 'confirm') {
    // Use the original values from the preset object
    const displayAmount = isFiatMode ? selectedPreset.usd : selectedPreset.sats;

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

  if (step === 'custom') {
    return (
      <View style={styles.stepContainer}>
        <TouchableOpacity
          style={{ marginTop: 10 }}
          activeOpacity={1}
          onPress={() => {
            setInputDenomination(prev => {
              return prev === 'sats' ? 'fiat' : 'sats';
            });
            setAmountValue(convertedValue() || '');
          }}
        >
          <FormattedBalanceInput
            maxWidth={0.9}
            amountValue={amountValue}
            inputDenomination={inputDenomination}
          />
          <FormattedSatText
            containerStyles={{ opacity: !amountValue ? HIDDEN_OPACITY : 1 }}
            neverHideBalance={true}
            styles={{ includeFontPadding: false, ...styles.satValue }}
            globalBalanceDenomination={
              inputDenomination === 'sats' ? 'fiat' : 'sats'
            }
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
          textContent={t('constants.continue')}
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
        onSelectPreset={setSelectedPreset}
        selectedPreset={selectedPreset}
        fiatStats={fiatStats}
        onCustomPress={handleCustomPress}
      />

      <CustomButton
        buttonStyles={[
          styles.continueButton,
          { opacity: !selectedPreset ? HIDDEN_OPACITY : 1 },
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
    marginBottom: 5,
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
