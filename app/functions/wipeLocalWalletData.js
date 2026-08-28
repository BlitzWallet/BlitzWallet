import { cacheDirectory, deleteAsync } from 'expo-file-system/legacy';
import {
  getLocalStorageItem,
  removeAllLocalData,
  setLocalStorageItem,
} from './localStorage';
import { PENDING_PARENT_CONTACT_KEY } from '../constants';
import { deleteTable } from './messaging/cachedMessages';
import { deletePOSTransactionsTable } from './pos';
import {
  deleteSparkContactsTransactionsTable,
  deleteSparkTransactionTable,
  deleteSpendAndReplaceTable,
  deleteUnpaidSparkLightningTransactionTable,
} from './spark/transactions';
import { deleteAccountBalanceSnapshotsTable } from './spark/balanceSnapshots';
import { deleteGiftsTable } from './gift/giftsStorage';
import { deleteGiftCardsTable } from './contacts/giftCardStorage';
import {
  deleteContributionsTable,
  deletePoolTable,
} from './pools/poolsStorage';
import {
  deleteSavingsGoalsTable,
  deleteSavingsPayoutsTable,
  deleteSavingsTransactionsTable,
} from './savings/savingsStorage';
import { deleteLeavesTable } from './spark/leavesStorage';
import { deleteRootstockSwapTable } from './boltz/rootstock/swapDb';
import { NWCInvoiceManager } from './nwc/cachedNWCTxs';
import { nwcEventLedger } from './nwc/eventLedger';
import {
  initializeAllDatabases,
  resetDatabaseInitialization,
} from './initializeAllDatabases';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from './crashlyticsLogs';
import {
  armWipeInProgress,
  disarmWipeInProgress,
  wipeStaleWalletKeychain,
} from './secureStore';

// AsyncStorage keys carried across the wipe. userSelectedLanguage keeps
// non-English users from flipping to en mid-onboarding; didViewSeedPhrase holds
// the value pin.js just wrote for the new wallet (a null default would flip a
// brand-new wallet to "already viewed" and suppress the backup nudge);
// pendingParentContactRid carries the child-claim pairing username through the
// onboarding wipe so globalContacts can auto-add the parent on home.
const PRESERVED_KEYS = [
  'userSelectedLanguage',
  'didViewSeedPhrase',
  PENDING_PARENT_CONTACT_KEY,
];

// Every wallet-local SQLite table. Do NOT gate on per-delete return values:
// several legacy deletes resolve undefined on success and some swallow their own
// errors, so truthiness is meaningless. The batch only fails on a thrown /
// rejected delete; a silently-failed drop is caught by the re-init pass in
// wipeLocalWalletData (a broken db makes initializeAllDatabases reject).
const tableDeletes = [
  deleteTable,
  deletePOSTransactionsTable,
  deleteSparkTransactionTable,
  deleteUnpaidSparkLightningTransactionTable,
  deleteSparkContactsTransactionsTable,
  deleteSpendAndReplaceTable,
  deleteAccountBalanceSnapshotsTable,
  deleteGiftsTable,
  deleteGiftCardsTable,
  deletePoolTable,
  deleteContributionsTable,
  deleteSavingsGoalsTable,
  deleteSavingsTransactionsTable,
  deleteSavingsPayoutsTable,
  deleteLeavesTable,
  deleteRootstockSwapTable,
  () => NWCInvoiceManager.resetDatabase(),
  () => nwcEventLedger.resetDatabase(),
];

export async function deleteAllLocalWalletTables() {
  const results = await Promise.allSettled(tableDeletes.map(run => run()));
  const rejected = results.filter(result => result.status === 'rejected');
  if (rejected.length > 0) {
    crashlyticsRecordErrorReport(
      `wipeLocalWalletData: ${rejected.length} table deletes rejected`,
    );
    return false;
  }
  return true;
}

// Filesystem caches (profile + token images) are keyed by pointers in
// AsyncStorage, which the wipe clears, so orphans are never rendered. Deleting
// them is belt-and-suspenders; a failure here is not worth blocking onboarding.
const IMAGE_CACHE_DIRS = ['profile_images/', 'tokenImages/'];

async function wipeImageCacheDirectories() {
  for (const dir of IMAGE_CACHE_DIRS) {
    try {
      await deleteAsync(cacheDirectory + dir, { idempotent: true });
    } catch (err) {
      console.log('Error wiping image cache directory', dir, err);
    }
  }
}

// Wipes everything wallet-local, including the previous wallet's keychain.
// Only the freshly written encryptedMnemonic + pinHash survive — the PIN page
// just wrote them for the NEW wallet (handleMnemonic.js
// storeMnemonicWithPinSecurity), so the keychain scrub keeps them and deletes
// every other secure-store item (NWC identity, custody, biometric, legacy
// pin/mnemonic). Used by create/restore onboarding so a previous wallet's
// stale AsyncStorage, SQLite cache, and keychain identity can never render as
// the new wallet's live data. Returns true only when the wipe fully succeeded.
export default async function wipeLocalWalletData() {
  // Arm the re-arm marker BEFORE any destructive step. It lives in the
  // keychain so removeAllLocalData can't clear it; it is disarmed only after
  // every step succeeded, so a failure or a process kill mid-wipe is retried
  // on the next launch (loadingScreen checks isWipeInProgress). Best-effort:
  // a failed arm falls back to today's behavior (wipe without re-arm).
  const didArm = await armWipeInProgress();
  if (!didArm) {
    crashlyticsLogReport('wipeLocalWalletData failed to arm wipe marker');
  }

  const preservedValues = {};
  for (const key of PRESERVED_KEYS) {
    preservedValues[key] = await getLocalStorageItem(key);
  }

  const didClearStorage = await removeAllLocalData();
  const didDeleteTables = await deleteAllLocalWalletTables();
  const didScrubKeychain = await wipeStaleWalletKeychain();

  await wipeImageCacheDirectories();

  let didReinitialize = false;
  try {
    resetDatabaseInitialization();
    await initializeAllDatabases();
    didReinitialize = true;
  } catch (err) {
    console.log('wipeLocalWalletData re-init error', err);
    crashlyticsLogReport('wipeLocalWalletData re-init failed');
    crashlyticsRecordErrorReport(
      `wipeLocalWalletData re-init failed: ${err?.message ?? err}`,
    );
  }

  // Restore the preserved keys across the wipe; Firestore re-sync restores the
  // rest of the settings on the loading screen.
  for (const key of PRESERVED_KEYS) {
    const value = preservedValues[key];
    if (value !== null && value !== undefined) {
      await setLocalStorageItem(key, value);
    }
  }

  if (
    !didClearStorage ||
    !didDeleteTables ||
    !didReinitialize ||
    !didScrubKeychain
  ) {
    crashlyticsLogReport(
      `wipeLocalWalletData failed: clearStorage=${didClearStorage} deleteTables=${didDeleteTables} reinit=${didReinitialize} scrubKeychain=${didScrubKeychain}`,
    );
    // Marker stays armed: the next launch re-runs the wipe instead of skipping
    // it because route.params.shouldWipeLocalData is gone.
    return false;
  }

  // Wipe fully succeeded; only now clear the marker (verified delete, since
  // iOS deleteItemAsync can silently fail). If the marker survives, report
  // failure so the next launch retries the wipe rather than re-wiping the new
  // wallet's healthy local data.
  const didDisarm = await disarmWipeInProgress();
  if (!didDisarm) {
    crashlyticsLogReport(
      'wipeLocalWalletData succeeded but wipe marker survived; re-arming',
    );
    return false;
  }
  return true;
}
