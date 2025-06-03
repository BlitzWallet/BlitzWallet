import {CashuMint, CashuWallet} from '@cashu/cashu-ts';
import {mnemonicToSeed} from '@scure/bip39';
import EventEmitter from 'events';
import {sumProofsValue} from './proofs';
import {getStoredProofs, setMintCounter, storeProofs} from './db';
export const restoreProofsEventListener = new EventEmitter();
export const RESTORE_PROOFS_EVENT_NAME = 'RESTORING_PROOF_EVENT';

const BATCH_SIZE = 100;
const MAX_GAP = 3;
export const restoreMintProofs = async (mintURL, accountMnemoinc) => {
  try {
    const seed = await mnemonicToSeed(accountMnemoinc);
    let progress = 0;

    restoreProofsEventListener.emit(
      RESTORE_PROOFS_EVENT_NAME,
      'Loading mint keysets...',
    );

    const mint = new CashuMint(mintURL);
    const allKeysets = await Promise.race([
      mint.getKeySets(),
      new Promise(res => setTimeout(res, 10000)),
    ]);
    if (!allKeysets) throw new Error('Not able to load keysets');
    const keysets = allKeysets.keysets;

    progress = 5;

    let highestCount = 0;
    let restoredSomething = false;
    const ksLen = keysets.length;
    const hexDigitsRegex = /^[0-9A-Fa-f]+$/;

    for (const [i, keyset] of keysets.entries()) {
      // Hex keyset validation
      if (!hexDigitsRegex.test(keyset.id)) {
        console.log(`Skipping ${keyset.id}. Not a hex keyset.`);
        continue;
      }

      const statusMessage = `Keyset ${i + 1} of ${ksLen}`;
      restoreProofsEventListener.emit(RESTORE_PROOFS_EVENT_NAME, statusMessage);

      // Restore keyset proofs
      const {restoredProofs, count} = await restoreKeyset(mint, keyset, seed);
      progress = Math.floor(((i + 1) / ksLen) * 100);

      if (count > highestCount) {
        highestCount = count;
        // Update the counter for this keyset
        console.log('SETTING COUNT', count + 1);
        await setMintCounter(mintURL, count + 1);
      }

      const restoredAmount = sumProofsValue(restoredProofs);
      if (restoredAmount > 0) {
        console.log(`Restored ${restoredAmount} for keyset ${keyset.id}`);
        restoredSomething = true;
        restoreProofsEventListener.emit(
          RESTORE_PROOFS_EVENT_NAME,
          `Restored ${restoredAmount} for keyset ${keyset.id} (${progress}%)`,
        );
      }
    }

    restoreProofsEventListener.emit(RESTORE_PROOFS_EVENT_NAME, 'end');
    return true;
  } catch (error) {
    console.error('Error restoring proofs:', error);
    restoreProofsEventListener.emit(
      RESTORE_PROOFS_EVENT_NAME,
      `Error: ${error.message}`,
    );
    return null;
  }
};

// Separate function for restoring a single keyset
const restoreKeyset = async (mint, keyset, seed) => {
  try {
    const keys = await mint.getKeys(keyset.id);
    const wallet = new CashuWallet(mint, {
      keys: keys.keysets,
      keysets: [keyset],
      bip39seed: Uint8Array.from(seed),
    });

    restoreProofsEventListener.emit(
      RESTORE_PROOFS_EVENT_NAME,
      `Loading keys for keyset ${keyset.id}`,
    );

    const {keysetProofs, count} = await restoreBatch(wallet, keyset.id);

    // Check proof states similar to the original
    restoreProofsEventListener.emit(
      RESTORE_PROOFS_EVENT_NAME,
      `Checking proof states for keyset ${keyset.id}`,
    );

    let restoredProofs = [];

    // Process proofs in batches to avoid potential issues with large sets
    for (let i = 0; i < keysetProofs.length; i += BATCH_SIZE) {
      const batchProofs = keysetProofs.slice(i, i + BATCH_SIZE);
      if (batchProofs.length === 0) continue;

      const proofStates = await wallet.checkProofsStates(batchProofs);

      // Filter for unspent proofs using the approach from the original code
      const unspentProofStateYs = proofStates
        .filter(ps => ps.state === 'UNSPENT')
        .map(ps => ps.Y);

      const unspentKeysetProofs = batchProofs.filter((p, idx) =>
        unspentProofStateYs.includes(proofStates[idx].Y),
      );

      // Store only new proofs
      const existingProofSecrets = await getStoredProofs(mint.mintUrl);
      const newProofs = unspentKeysetProofs.filter(
        p => !existingProofSecrets.includes(p.secret),
      );

      if (newProofs.length > 0) {
        await storeProofs(newProofs, mint.mintUrl);
        restoredProofs = restoredProofs.concat(newProofs);
      }
    }

    return {restoredProofs, count};
  } catch (error) {
    console.error(`Error in restoreKeyset for ${keyset.id}:`, error);
    restoreProofsEventListener.emit(
      RESTORE_PROOFS_EVENT_NAME,
      `Error restoring keyset ${keyset.id}: ${error.message}`,
    );
    throw error;
  }
};

// Handle batching like the original code
const restoreBatch = async (wallet, keysetId) => {
  let keysetProofs = [];
  try {
    let newProofs = [];
    let start = 0;
    let lastFound = 0;
    let noProofsFoundCounter = 0;
    const noProofsFoundLimit = MAX_GAP;

    do {
      restoreProofsEventListener.emit(
        RESTORE_PROOFS_EVENT_NAME,
        `Restoring ${start} through ${start + BATCH_SIZE}`,
      );

      const {proofs} = await wallet.restore(start, BATCH_SIZE, {keysetId});
      newProofs = [...proofs];
      keysetProofs.push(...proofs);

      start = start + BATCH_SIZE;

      if (newProofs.length) {
        console.log(
          `> Restored ${proofs.length} proofs with sum ${sumProofsValue(
            proofs,
          )}`,
        );
        noProofsFoundCounter = 0;
        lastFound = start + proofs.length;
      } else {
        noProofsFoundCounter++;
        console.log(
          `No proofs found in batch starting at ${start - BATCH_SIZE}`,
        );
      }
    } while (noProofsFoundCounter < noProofsFoundLimit);

    console.log(lastFound + 1, 'setting count');
    return {keysetProofs, count: lastFound + 1};
  } catch (error) {
    console.error('Error in restoreBatch:', error);
    restoreProofsEventListener.emit(
      RESTORE_PROOFS_EVENT_NAME,
      `Error restoring batch: ${error.message}`,
    );
    throw error;
  }
};
