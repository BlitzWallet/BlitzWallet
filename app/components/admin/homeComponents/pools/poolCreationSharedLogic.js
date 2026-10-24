import { useCallback, useEffect, useState } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { v4 as uuidv4 } from 'uuid';
import i18n from 'i18next';
import {
  MAX_INDEX_FOR_POOLS_DERIVE,
  STARTING_INDEX_FOR_POOLS_DERIVE,
} from '../../../../constants';
import { derivePoolWallet } from '../../../../functions/pools/derivePoolWallet';

/**
 * Derives the next pool wallet and builds the pool document (not saved yet;
 * PoolDetailScreen saves it when opened with shouldSave).
 */
export async function createPoolDocument({
  masterInfoObject,
  accountMnemoinc,
  globalContactsInformation,
  poolTitle,
  goalAmount,
}) {
  const currentDerivedPoolIndex = masterInfoObject.currentDerivedPoolIndex || 0;
  const derivationIndex =
    STARTING_INDEX_FOR_POOLS_DERIVE + currentDerivedPoolIndex;

  // Hard cap: pool indices must stay below the savings space (200000).
  // Using >= (not ===) so a corrupted counter can never slip past.
  if (derivationIndex >= MAX_INDEX_FOR_POOLS_DERIVE) {
    throw new Error(i18n.t('wallet.pools.maxPoolsReached'));
  }

  const derivedWallet = await derivePoolWallet(
    accountMnemoinc,
    derivationIndex,
  );

  const creatorProfile = globalContactsInformation?.myProfile || {};

  return {
    poolId: uuidv4(),
    creatorUUID: masterInfoObject.uuid,
    creatorName: creatorProfile.name || creatorProfile.uniqueName || '',

    poolTitle: poolTitle.trim(),
    goalAmount,
    currentAmount: 0,

    status: 'active',

    sparkAddress: derivedWallet.sparkAddress,
    identityPubKey: derivedWallet.identityPubKeyHex,
    derivationIndex,

    poolDenomination: masterInfoObject.fiatCurrency,

    createdAt: Date.now(),
    closedAt: null,
    transferTxId: null,

    contributorCount: 0,
    lastContributionAt: null,
    topContributors: [],
  };
}

/**
 * Shared hook for pool creation multi-step flow
 * Used by PoolCreationOverlay (receive modal)
 *
 * @param {Function} onComplete - Callback when pool creation is complete
 * @param {Function} onCancel - Callback when flow is canceled
 */
export const usePoolCreationFlow = ({ onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState('amount'); // 'amount' | 'description'
  const [goalAmount, setGoalAmount] = useState(null);

  // Amount overlay animation
  const amountOpacity = useSharedValue(1);
  const amountTranslateX = useSharedValue(0);

  // Description overlay animation
  const descOpacity = useSharedValue(0);
  const descTranslateX = useSharedValue(30);

  useEffect(() => {
    if (currentStep === 'description') {
      // Hide amount, show description
      amountOpacity.value = withTiming(0, { duration: 250 });
      amountTranslateX.value = withTiming(-30, { duration: 250 });
      descOpacity.value = withTiming(1, { duration: 250 });
      descTranslateX.value = withTiming(0, { duration: 250 });
    } else {
      // Show amount, hide description
      amountOpacity.value = withTiming(1, { duration: 250 });
      amountTranslateX.value = withTiming(0, { duration: 250 });
      descOpacity.value = withTiming(0, { duration: 250 });
      descTranslateX.value = withTiming(30, { duration: 250 });
    }
  }, [currentStep]);

  const amountStyle = useAnimatedStyle(() => ({
    opacity: amountOpacity.value,
    transform: [{ translateX: amountTranslateX.value }],
    pointerEvents: amountOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  const descStyle = useAnimatedStyle(() => ({
    opacity: descOpacity.value,
    transform: [{ translateX: descTranslateX.value }],
    pointerEvents: descOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  return {
    currentStep,
    goalAmount,
    setGoalAmount,
    setCurrentStep,
    amountStyle,
    descStyle,
    onComplete,
    onCancel,
  };
};
