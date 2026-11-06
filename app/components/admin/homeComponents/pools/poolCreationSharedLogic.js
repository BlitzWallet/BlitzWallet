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
