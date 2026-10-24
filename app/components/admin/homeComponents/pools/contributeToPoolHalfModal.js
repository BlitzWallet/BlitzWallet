import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { CENTER } from '../../../../constants';
import { useTranslation } from 'react-i18next';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { sparkPaymenWrapper } from '../../../../functions/spark/payments';
import { addContributionWithTransaction } from '../../../../../db';
import { v4 as uuidv4 } from 'uuid';
import PresetAmountGrid from './presetAmountGrid';
import PoolAmountKeypad from './components/poolAmountKeypad';
import CustomButton from '../../../../functions/CustomElements/button';
import SwipeButtonNew from '../../../../functions/CustomElements/sliderButton';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import Note from '../../../../functions/CustomElements/redesign/Note';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import StepProgress from '../../../../functions/CustomElements/redesign/StepProgress';
import AnimatedStep, {
  growThenStep,
  useStepSheetHeight,
} from '../../../../functions/CustomElements/redesign/AnimatedStep';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
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
import { simulateSwap } from '../../../../functions/spark/flashnet';

const STEP_HEIGHTS = {
  select: 400,
  custom: 700,
  confirm: 470,
  loading: 470,
  success: 520,
};

function SlideThumbIcon() {
  const { tokens } = GetThemeColors();
  return (
    <ThemeIcon
      redesign
      iconName="ArrowRight"
      size={22}
      colorOverride={tokens.onAccent}
    />
  );
}

export default function ContributeToPoolHalfModal({
  pool,
  poolId,
  setContentHeight,
  handleBackPressFunction,
  setDismissLocked,
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
  const { poolInfoRef, swapLimits } = useFlashnet();
  const { tokens } = GetThemeColors();
  const { t } = useTranslation();

  // Page history; back pops to where the user came from.
  const [step, setStep] = useState(['select']);
  const [direction, setDirection] = useState(1);
  const [selectedAmountSats, setSelectedAmountSats] = useState(0);
  const currentPage = step[step.length - 1];

  useStepSheetHeight(setContentHeight, STEP_HEIGHTS[currentPage]);

  // The sheet can't be swiped or tapped away while the payment is in flight.
  useEffect(() => {
    setDismissLocked?.(currentPage === 'loading');
  }, [currentPage, setDismissLocked]);

  // A step's exit side is read from its last render while still active, so
  // the direction has to land one render before the step changes.
  const moveStep = useCallback(
    (nextDirection, nextPage, update) => {
      setDirection(nextDirection);
      growThenStep(
        setContentHeight,
        STEP_HEIGHTS[currentPage],
        STEP_HEIGHTS[nextPage],
        () => setTimeout(() => setStep(update), 0),
      );
    },
    [currentPage, setContentHeight],
  );

  const pushStep = useCallback(
    page => moveStep(1, page, prev => [...prev, page]),
    [moveStep],
  );

  const goBack = useCallback(() => {
    const previous = step[step.length - 2];
    if (previous === 'select') setSelectedAmountSats(0);
    moveStep(-1, previous, prev => prev.slice(0, -1));
  }, [step, moveStep]);

  // Handle Android back button with multi-step logic
  const handleBackPress = useCallback(() => {
    if (currentPage === 'loading') return true;
    if (currentPage === 'success' || step.length === 1) return false;
    goBack();
    return true;
  }, [currentPage, step, goBack]);

  useHandleBackPressNew(handleBackPress);

  const formatAmount = amount =>
    displayCorrectDenomination({ amount, masterInfoObject, fiatStats });

  const validate = sats =>
    validatePoolPayment({
      bitcoinBalance,
      dollarBalanceToken,
      paymentAmountSats: sats,
      paymentAmountUSD: satsToDollars(sats, poolInfoRef.currentPriceAInB),
      swapLimits,
    });

  const swapMinimumSats =
    dollarsToSats(swapLimits.usd, poolInfoRef.currentPriceAInB) + 10;

  const handleContinue = sats => {
    if (!sats) return;
    const validation = validate(sats);

    if (!validation.isValid) {
      const errorMessage =
        validation.errorReason === 'BELOW_USD_SWAP_MINIMUM'
          ? t('wallet.sendPages.acceptButton.swapMinimumError', {
              amount: formatAmount(swapMinimumSats),
              currency1: t('constants.dollars_upper'),
              currency2: t('constants.bitcoin_upper'),
            })
          : t('wallet.sendPages.acceptButton.balanceError');
      navigate.navigate('ErrorScreen', { errorMessage });
      return;
    }

    setSelectedAmountSats(sats);
    pushStep('confirm');
  };

  const handleConfirmPayment = async () => {
    try {
      pushStep('loading');
      const paymentAmountSats = selectedAmountSats;
      const paymentAmountUSD = satsToDollars(
        paymentAmountSats,
        poolInfoRef.currentPriceAInB,
      );
      const paymentMethod = validate(paymentAmountSats).paymentMethod;

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
          throw new Error(
            simResult.error || t('wallet.pools.swapSimulationFailed'),
          );
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
        throw new Error(
          paymentResponse.error || t('wallet.pools.paymentFailed'),
        );
      }

      const actualAmountSats = paymentResponse.response.details.amount;

      const creatorProfile = globalContactsInformation?.myProfile || {};
      const contribution = {
        contributionId: uuidv4(),
        poolId,
        contributorName:
          creatorProfile.name ||
          creatorProfile.uniqueName ||
          t('wallet.pools.blitzUser'),
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

      pushStep('success');
    } catch (err) {
      console.log('Error contributing to pool:', err);
      handleBackPressFunction(() => {
        navigate.replace('ErrorScreen', { errorMessage: err.message });
      });
    }
  };

  const toPoolText = `${t('wallet.pools.contributeTo')}${pool.poolTitle}`;

  return (
    <View style={styles.container}>
      <AnimatedStep
        active={currentPage === 'select'}
        direction={direction}
        exitsBack={direction === -1}
      >
        <ThemeText
          styles={styles.selectTitle}
          content={t('wallet.pools.chooseContributionAmount')}
        />

        <PresetAmountGrid
          onSelectPreset={setSelectedAmountSats}
          selectedAmountSats={selectedAmountSats}
          fiatStats={fiatStats}
          onCustomPress={() => {
            setSelectedAmountSats(0);
            pushStep('custom');
          }}
        />

        <CustomButton
          buttonStyles={styles.bottomButton}
          textContent={t('constants.continue')}
          actionFunction={() => handleContinue(selectedAmountSats)}
          disabled={!selectedAmountSats}
          size="regular"
        />
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'custom'}
        direction={direction}
        exitsBack={direction === -1}
      >
        <PoolAmountKeypad
          onBack={goBack}
          subText={(sats, format) => {
            const validation = sats ? validate(sats) : null;
            return validation?.errorReason === 'BELOW_USD_SWAP_MINIMUM'
              ? t('wallet.pools.minimum', { amount: format(swapMinimumSats) })
              : t('wallet.pools.available', {
                  amount: format(Math.max(bitcoinBalance, dollarBalanceSat)),
                });
          }}
          buttonText={sats =>
            sats ? t('constants.continue') : t('constants.back')
          }
          onContinue={sats => (sats ? handleContinue(sats) : goBack())}
        />
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'confirm'}
        direction={direction}
        exitsBack={direction === -1}
      >
        <TopBar onBack={goBack} />
        <View style={styles.confirmAmount}>
          <AmountHero
            amount={selectedAmountSats}
            fiatStats={fiatStats}
            amountSize={52}
          />
          <ThemeText
            styles={[styles.muted, { color: tokens.muted }]}
            content={toPoolText}
          />
        </View>

        <View style={styles.confirmBottom}>
          <Note tone="warn" text={t('wallet.pools.contributionWarning')} />
          <SwipeButtonNew
            onSwipeSuccess={handleConfirmPayment}
            title={t('wallet.pools.slideToContribute')}
            width={0.9}
            height={59}
            containerStyles={{
              backgroundColor: tokens.disc,
              borderColor: tokens.disc,
            }}
            railStyles={{
              backgroundColor: tokens.accent,
              borderColor: tokens.accent,
            }}
            thumbIconStyles={{
              backgroundColor: tokens.accent,
              borderColor: tokens.accent,
            }}
            thumbIconComponent={SlideThumbIcon}
            titleStyles={{ color: tokens.muted }}
          />
        </View>
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'loading'}
        direction={direction}
        exitsBack={direction === -1}
      >
        <View style={styles.loading}>
          <StepProgress
            title={t('wallet.pools.sendingContribution')}
            subtitle={`${formatAmount(selectedAmountSats)} ${toPoolText}`}
          />
        </View>
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'success'}
        direction={direction}
        fadeOnly={true}
      >
        <View style={styles.success}>
          <Disc icon="Check" size={88} iconSize={40} tone="primary" />
          <ThemeText
            styles={[
              styles.muted,
              styles.successLabel,
              { color: tokens.muted },
            ]}
            content={t('wallet.pools.contributionSent')}
          />
          <AmountHero
            amount={selectedAmountSats}
            fiatStats={fiatStats}
            amountSize={48}
          />
          <ThemeText
            styles={[styles.muted, styles.successTo, { color: tokens.muted }]}
            content={t('wallet.pools.sentTo', { name: pool.poolTitle })}
          />
        </View>
        <CustomButton
          buttonStyles={styles.bottomButton}
          actionFunction={handleBackPressFunction}
          textContent={t('constants.done')}
          size="regular"
        />
      </AnimatedStep>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    overflow: 'hidden',
  },
  selectTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginTop: 12,
    marginBottom: 16,
    includeFontPadding: false,
  },
  bottomButton: {
    width: '100%',
    marginTop: 'auto',
  },
  confirmAmount: {
    marginTop: 28,
    alignItems: 'center',
  },
  muted: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 4,
    includeFontPadding: false,
  },
  confirmBottom: {
    marginTop: 'auto',
    gap: 16,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
  },
  success: {
    marginTop: 40,
    alignItems: 'center',
  },
  successLabel: {
    marginTop: 28,
  },
  successTo: {
    marginTop: 10,
  },
});
