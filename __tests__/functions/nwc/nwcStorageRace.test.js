/* eslint-env jest */
// A connection is live for JS while it is in AsyncStorage + SecureStore, and for
// the native handlers while it is in native_config.json (an Android :nwc
// process can keep a cached copy of SecureStore, so on Android the config file
// alone revokes). Every write to those stores must leave a deleted connection
// deleted and an edited one edited. Ways this can fail, each covered below:
//  1. A pay_invoice in flight writes the accounts it read at its start back
//     over a connection the user deleted meanwhile.
//  2. The same write-back reverts a limit the user edited meanwhile.
//  3. getNWCData's own write-back (spend mirrored from the ledger) lands after,
//     and over, a write the UI made while it was reading.
//  4. Serializing the writes lets one failed write block every later one.
//  5. The fix stops the spend sync from updating the displayed totalSent.
//  6. A native_config.json write fails and leaves the previous file, so the
//     deleted connection stays live for the native handlers.
//  7. Reading NWC data (login, request handling) waits on a write, so one slow
//     or stuck write, its own write-back or another caller's, blocks login.

jest.mock('expo-sqlite', () => {
  const { DatabaseSync: DB } = require('node:sqlite');
  const connections = new Map();
  return {
    __esModule: true,
    defaultDatabaseDirectory: '/data/SQLite',
    openDatabaseAsync: jest.fn(async name => {
      if (!connections.has(name)) connections.set(name, new DB(':memory:'));
      const sqlite = connections.get(name);
      return {
        execAsync: async sql => sqlite.exec(sql),
        runAsync: async (sql, params = []) => {
          const r = sqlite.prepare(sql).run(...params);
          return { changes: r.changes, lastInsertRowId: r.lastInsertRowid };
        },
        getAllAsync: async (sql, params = []) =>
          sqlite.prepare(sql).all(...params),
        getFirstAsync: async (sql, params = []) =>
          sqlite.prepare(sql).get(...params) ?? null,
      };
    }),
  };
});
jest.mock('expo-file-system', () => {
  const files = new Map();
  const uriOf = (parent, name) => {
    const base = typeof parent === 'string' ? parent : parent.uri;
    return name ? `${base}/${name}` : base;
  };
  class Directory {
    constructor(parent, name) {
      this.uri = uriOf(parent, name);
    }
    get exists() {
      return true;
    }
    create() {}
    delete() {}
  }
  class File {
    constructor(parent, name) {
      this.uri = uriOf(parent, name);
    }
    get exists() {
      return files.has(this.uri);
    }
    write(text) {
      files.set(this.uri, text);
    }
    delete() {
      files.delete(this.uri);
    }
    move(target) {
      files.set(target.uri, files.get(this.uri));
      files.delete(this.uri);
    }
  }
  return {
    __files: files,
    Directory,
    File,
    Paths: {
      appleSharedContainers: {
        'group.com.blitzwallet.application': 'file:///group',
      },
    },
  };
});
jest.mock('../../../app/functions/secureStore', () => {
  const store = new Map();
  return {
    __store: store,
    retrieveData: jest.fn(async key => ({
      didWork: true,
      value: store.get(key) ?? null,
    })),
    storeData: jest.fn(async (key, value) => {
      store.set(key, value);
      return true;
    }),
  };
});
jest.mock('../../../app/functions/localStorage', () => {
  const store = new Map();
  return {
    __store: store,
    getLocalStorageItem: jest.fn(async key => store.get(key) ?? null),
    setLocalStorageItem: jest.fn(async (key, value) => {
      store.set(key, value);
      return true;
    }),
  };
});
jest.mock('../../../app/constants', () => ({
  NOSTR_RELAY_URL: 'wss://relay.example.com',
  NWC_LOACAL_STORE_KEY: 'NWC_LOACAL_STORE_KEY',
  NWC_SECURE_STORE_KEY: 'NWC_SECURE_STORE_KEY',
}));
jest.mock('../../../app/functions/nwc/publishResponse', () => ({
  publishToSingleRelay: jest.fn(async () => {}),
}));
jest.mock('../../../app/functions/notifications', () => ({
  pushInstantNotification: jest.fn(),
}));
jest.mock('i18next', () => ({
  language: 'en',
  t: key => key,
  changeLanguage: jest.fn(async () => {}),
}));
jest.mock('../../../app/functions/decodeBolt11', () => ({
  __esModule: true,
  default: {
    decode: jest.fn(() => ({
      millisatoshis: '5000',
      tags: [{ tagName: 'payment_hash', data: 'ab'.repeat(32) }],
    })),
  },
}));
const mockWallet = {
  initializeNWCWallet: jest.fn(),
  sendNWCSparkLightningPayment: jest.fn(),
  NWCSparkLightningPaymentStatus: jest.fn(),
  getNWCSparkTransactions: jest.fn(),
};
jest.mock('../../../app/functions/nwc/wallet', () => ({
  __esModule: true,
  nwcWallet: null,
  initializeNWCWallet: (...a) => mockWallet.initializeNWCWallet(...a),
  sendNWCSparkLightningPayment: (...a) =>
    mockWallet.sendNWCSparkLightningPayment(...a),
  NWCSparkLightningPaymentStatus: (...a) =>
    mockWallet.NWCSparkLightningPaymentStatus(...a),
  getNWCSparkTransactions: (...a) => mockWallet.getNWCSparkTransactions(...a),
}));
jest.mock('../../../app/functions/spark', () => ({
  getSparkPaymentStatus: jest.fn(status =>
    status === 'SUCCEEDED' ? 'completed' : 'pending',
  ),
}));

const { finalizeEvent, getPublicKey, nip44 } = require('nostr-tools');
const {
  splitAndStoreNWCData,
  getNWCData,
} = require('../../../app/functions/nwc');
const { nwcEventLedger } = require('../../../app/functions/nwc/eventLedger');
const NWCInvoiceManager =
  require('../../../app/functions/nwc/cachedNWCTxs').default;
const handleNWCBackgroundEvent =
  require('../../../app/functions/nwc/backgroundNofifications').default;
const {
  publishToSingleRelay,
} = require('../../../app/functions/nwc/publishResponse');
const secureStore = require('../../../app/functions/secureStore');
const localStorage = require('../../../app/functions/localStorage');
const fileSystem = require('expo-file-system');

const keypair = byte => {
  const privateKey = byte.repeat(32);
  return { privateKey, publicKey: getPublicKey(privateKey) };
};
const A = keypair('02'); // the connection that pays
const B = keypair('04'); // another connection
const clientSecret = '03'.repeat(32);
const account = ({ privateKey, publicKey }, name) => ({
  accountName: name,
  permissions: { sendPayments: true },
  budgetRenewalSettings: { option: 'daily', amount: 100 },
  privateKey,
  publicKey,
  clientPubkey: getPublicKey(clientSecret),
});
const initial = {
  accounts: { [A.publicKey]: account(A, 'A'), [B.publicKey]: account(B, 'B') },
};
const withoutB = { accounts: { [A.publicKey]: initial.accounts[A.publicKey] } };

const conversationKey = () =>
  nip44.getConversationKey(Buffer.from(clientSecret, 'hex'), A.publicKey);
const payPush = () => {
  const signed = finalizeEvent(
    {
      kind: 23194,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', A.publicKey]],
      content: nip44.encrypt(
        JSON.stringify({
          method: 'pay_invoice',
          params: { invoice: 'lnbc-js' },
        }),
        conversationKey(),
      ),
    },
    Buffer.from(clientSecret, 'hex'),
  );
  return {
    data: {
      body: JSON.stringify({
        events: [
          { ...signed, pubkey: A.publicKey, clientPubKey: signed.pubkey },
        ],
      }),
    },
  };
};
const lastResponse = () => {
  const [[event]] = publishToSingleRelay.mock.calls.at(-1);
  return JSON.parse(nip44.decrypt(event.content, conversationKey()));
};

// What each runtime would see as stored.
const stored = async () => ({
  local: JSON.parse(localStorage.__store.get('NWC_LOACAL_STORE_KEY')).accounts,
  secrets: JSON.parse(secureStore.__store.get('NWC_SECURE_STORE_KEY')),
  native: (() => {
    const raw = fileSystem.__files.get('file:///group/nwc/native_config.json');
    return raw ? JSON.parse(raw).accounts : null;
  })(),
});
const settle = () => new Promise(resolve => setTimeout(resolve, 50));

beforeEach(async () => {
  await nwcEventLedger.resetDatabase();
  await NWCInvoiceManager.resetDatabase();
  localStorage.__store.clear();
  secureStore.__store.clear();
  fileSystem.__files.clear();
  jest.clearAllMocks();
  mockWallet.initializeNWCWallet.mockResolvedValue({ isConnected: true });
  mockWallet.sendNWCSparkLightningPayment.mockResolvedValue({
    didWork: true,
    paymentResponse: { id: 'send-1', fee: { originalValue: 0 } },
  });
  mockWallet.NWCSparkLightningPaymentStatus.mockResolvedValue({
    didWork: true,
    paymentResponse: { status: 'SUCCEEDED', paymentPreimage: 'preimage' },
  });
  await splitAndStoreNWCData(initial);
});

describe('a pay_invoice in flight', () => {
  // toggleNWCInformation writes the UI's state while the send is running.
  const whileSending = uiWrite =>
    mockWallet.sendNWCSparkLightningPayment.mockImplementationOnce(async () => {
      await splitAndStoreNWCData(uiWrite);
      return {
        didWork: true,
        paymentResponse: { id: 'send-1', fee: { originalValue: 0 } },
      };
    });

  test('does not bring back a connection deleted meanwhile (1, 5)', async () => {
    whileSending(withoutB);

    await handleNWCBackgroundEvent(payPush());
    await settle();

    expect(lastResponse().result.preimage).toBe('preimage');
    const { local, secrets, native } = await stored();
    expect(Object.keys(local)).toEqual([A.publicKey]);
    expect(Object.keys(secrets)).toEqual([A.publicKey]);
    expect(Object.keys(native)).toEqual([A.publicKey]);
    expect(local[A.publicKey].totalSent).toBe(5);
    expect(native[A.publicKey].totalSent).toBe(5);
  });

  test('does not revert a limit edited meanwhile (2, 5)', async () => {
    const edited = {
      accounts: {
        ...initial.accounts,
        [A.publicKey]: {
          ...initial.accounts[A.publicKey],
          budgetRenewalSettings: { option: 'daily', amount: 200 },
        },
      },
    };
    whileSending(edited);

    await handleNWCBackgroundEvent(payPush());
    await settle();

    const { local, native } = await stored();
    expect(local[A.publicKey].budgetRenewalSettings.amount).toBe(200);
    expect(native[A.publicKey].budgetRenewalSettings.amount).toBe(200);
    expect(local[A.publicKey].totalSent).toBe(5);
  });
});

describe('storage writes', () => {
  test("getNWCData's write-back never lands over a write made while it read (3)", async () => {
    let reachedLedger;
    const atLedger = new Promise(resolve => (reachedLedger = resolve));
    let releaseLedger;
    const ledgerGate = new Promise(resolve => (releaseLedger = resolve));
    // No spend recorded yet, so getNWCData backfills lastRotated/totalSent and
    // writes the accounts it read back.
    const spy = jest
      .spyOn(nwcEventLedger, 'getSpendState')
      .mockImplementationOnce(async () => {
        reachedLedger();
        await ledgerGate;
        return null;
      });

    const read = getNWCData();
    await atLedger;
    const uiWrite = splitAndStoreNWCData(withoutB);
    releaseLedger();
    await Promise.all([read, uiWrite]);
    await settle();
    spy.mockRestore();

    const { local, secrets, native } = await stored();
    expect(Object.keys(local)).toEqual([A.publicKey]);
    expect(Object.keys(secrets)).toEqual([A.publicKey]);
    expect(Object.keys(native)).toEqual([A.publicKey]);
  });

  test('a failed write does not block later ones (4)', async () => {
    secureStore.storeData.mockRejectedValueOnce(new Error('keystore'));
    await expect(splitAndStoreNWCData(initial)).rejects.toThrow('keystore');

    await splitAndStoreNWCData(withoutB);

    const { secrets } = await stored();
    expect(Object.keys(secrets)).toEqual([A.publicKey]);
  });

  test('a failed native config write removes the old config, so native handlers hand off to JS (6)', async () => {
    expect(Object.keys((await stored()).native)).toHaveLength(2);
    const spy = jest
      .spyOn(fileSystem.File.prototype, 'write')
      .mockImplementationOnce(() => {
        throw new Error('ENOSPC');
      });

    await splitAndStoreNWCData(withoutB);
    spy.mockRestore();

    expect((await stored()).native).toBeNull();
  });
});

describe('reading NWC data (login)', () => {
  // A SecureStore write that hangs until released; released at the end of each
  // test so the storage queue drains.
  const stuckWrite = () => {
    let release;
    const gate = new Promise(resolve => (release = resolve));
    secureStore.storeData.mockImplementationOnce(async (key, value) => {
      await gate;
      secureStore.__store.set(key, value);
      return true;
    });
    return release;
  };
  const resolvesPromptly = promise =>
    Promise.race([
      promise.then(() => 'resolved'),
      new Promise(resolve => setTimeout(() => resolve('blocked'), 200)),
    ]);

  test('does not wait for its own write-back (7)', async () => {
    // Nothing spent is stored yet, so getNWCData backfills totalSent and
    // lastRotated and writes them back.
    const release = stuckWrite();
    try {
      expect(await resolvesPromptly(getNWCData())).toBe('resolved');
    } finally {
      release();
      await settle();
    }
  });

  test("does not wait for another caller's write in progress (7)", async () => {
    const release = stuckWrite();
    const uiWrite = splitAndStoreNWCData(withoutB);
    try {
      expect(await resolvesPromptly(getNWCData())).toBe('resolved');
    } finally {
      release();
      await uiWrite;
      await settle();
    }
    const { local, secrets, native } = await stored();
    expect(Object.keys(local)).toEqual([A.publicKey]);
    expect(Object.keys(secrets)).toEqual([A.publicKey]);
    expect(Object.keys(native)).toEqual([A.publicKey]);
  });
});
