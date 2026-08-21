import {
  NOSTR_RELAY_URL,
  NWC_LOACAL_STORE_KEY,
  NWC_SECURE_STORE_KEY,
} from '../../constants';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';
import { retrieveData, storeData } from '../secureStore';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import { randomBytes } from 'react-native-quick-crypto';
import sha256Hash from '../hash';
import { createAccountMnemonic } from '../seed';
import { privateKeyFromSeedWords } from '../nostrCompatability';
import { publishToSingleRelay } from './publishResponse';

export async function getNWCAccountInformation() {
  try {
    const localNWCInformation = await retrieveData(NWC_SECURE_STORE_KEY);

    if (localNWCInformation.didWork && localNWCInformation.value !== null) {
      return { didWork: true, data: JSON.parse(localNWCInformation.value) };
    } else {
      await storeData(NWC_SECURE_STORE_KEY, JSON.stringify({}));
      return { didWork: true, data: {} };
    }
  } catch (error) {
    console.error('Error retrieving NWC account information:', error);
    return { didWork: false, error };
  }
}

export function getSupportedMethods(accountPermissions) {
  const supportedCommands = [];
  if (accountPermissions.receivePayments) {
    supportedCommands.push('make_invoice');
  }
  if (accountPermissions.sendPayments) {
    supportedCommands.push('pay_invoice');
  }
  if (accountPermissions.getBalance) {
    supportedCommands.push('get_balance');
  }
  if (accountPermissions.transactionHistory) {
    supportedCommands.push('list_transactions');
  }
  if (accountPermissions.lookupInvoice) {
    supportedCommands.push('lookup_invoice');
  }
  supportedCommands.push('get_info');

  return supportedCommands;
}

const SENSITIVE_KEYS = ['privateKey', 'secret'];

export async function splitAndStoreNWCData(obj) {
  let sensitiveData = {};
  const nonSensitiveData = JSON.parse(JSON.stringify(obj));

  for (const [accountId, account] of Object.entries(
    nonSensitiveData.accounts || {},
  )) {
    sensitiveData[accountId] = {};
    for (const key of SENSITIVE_KEYS) {
      if (key in account) {
        sensitiveData[accountId][key] = account[key];
        delete nonSensitiveData.accounts[accountId][key];
      }
    }
  }

  await storeData(NWC_SECURE_STORE_KEY, JSON.stringify(sensitiveData));

  await setLocalStorageItem(
    NWC_LOACAL_STORE_KEY,
    JSON.stringify(nonSensitiveData),
  );
}

export async function getNWCData() {
  const [sensitiveJson, nonSensitiveJson] = await Promise.all([
    retrieveData(NWC_SECURE_STORE_KEY).then(data => data.value),
    getLocalStorageItem(NWC_LOACAL_STORE_KEY),
  ]);

  if (!nonSensitiveJson) return {};

  const nonSensitiveData = JSON.parse(nonSensitiveJson);
  const sensitiveData = sensitiveJson ? JSON.parse(sensitiveJson) : {};
  let didUpdate = false;

  for (const [accountId, sensFields] of Object.entries(sensitiveData)) {
    if (nonSensitiveData.accounts?.[accountId]) {
      const mergedAccount = {
        ...nonSensitiveData.accounts[accountId],
        ...sensFields,
      };

      if (!mergedAccount.hasOwnProperty('lastRotated')) {
        mergedAccount.lastRotated = new Date().getTime();
        didUpdate = true;
      }
      if (!mergedAccount.hasOwnProperty('totalSent')) {
        mergedAccount.totalSent = 0;
        didUpdate = true;
      }
      if (!mergedAccount.hasOwnProperty('clientPubkey') && mergedAccount.secret) {
        try {
          mergedAccount.clientPubkey = getPublicKey(mergedAccount.secret);
          didUpdate = true;
        } catch (err) {
          console.error('Error deriving NWC client public key', err);
        }
      }

      nonSensitiveData.accounts[accountId] = mergedAccount;
    }
  }

  if (didUpdate) {
    splitAndStoreNWCData(nonSensitiveData);
  }

  return nonSensitiveData;
}

export async function saveNWCAccount({
  savedData = {},
  accountName,
  permissions,
  budgetRenewalSettings,
  existingAccounts = {},
}) {
  let privateKey, publicKey, secret;
  if (!savedData?.publicKey) {
    const mnemonic = await createAccountMnemonic();
    privateKey = await privateKeyFromSeedWords(mnemonic);
    publicKey = getPublicKey(privateKey);
    secret = sha256Hash(randomBytes(32));
  } else {
    privateKey = savedData.privateKey;
    publicKey = savedData.publicKey;
    secret = savedData.secret;
  }
  const clientPubkey = getPublicKey(secret);

  const infoEvent = {
    kind: 13194,
    created_at: Math.floor(Date.now() / 1000),
    content: getSupportedMethods(permissions).join(' '),
    tags: [],
  };

  const signedEvent = finalizeEvent(
    infoEvent,
    Buffer.from(privateKey, 'hex'),
  );

  await publishToSingleRelay([signedEvent], NOSTR_RELAY_URL);

  return {
    accounts: {
      ...existingAccounts,
      [publicKey]: {
        accountName,
        permissions,
        budgetRenewalSettings,
        privateKey,
        publicKey,
        secret,
        clientPubkey,
      },
    },
  };
}

export function isWithinNWCBalanceTimeFrame(duration, lastRotated) {
  if (!duration) return true;
  const now = new Date();
  const last = new Date(lastRotated);

  let diffInMs = now - last;

  switch (duration.toLowerCase()) {
    case 'daily':
      return diffInMs < 24 * 60 * 60 * 1000; // 24 hours
    case 'weekly':
      return diffInMs < 7 * 24 * 60 * 60 * 1000; // 7 days
    case 'monthly':
      return diffInMs < 30 * 24 * 60 * 60 * 1000; // ~30 days
    case 'yearly':
      return diffInMs < 365 * 24 * 60 * 60 * 1000; // ~1 year
    default:
      return true;
  }
}
