/* eslint-env jest */
// ---------------------------------------------------------------------------
// childPairingContext — parent-side pairing state machine (username rendezvous).
//
// Drives the real provider with mocked `../db` helpers and injects Firestore
// events through captured subscribePairingDoc callbacks. The rendezvous is now
// the parent's own username; a session is opened via a transaction
// (startPairingSession → sessionId) and EVERY teardown marks the pointer
// terminal (endPairingSession) so re-pairing is immediately unblocked.
//   - happy path: startPairing → childHello → confirm → Match → childConfirm →
//     done; the grant ciphertext decrypts under the child's ECDH key.
//   - re-pair back-to-back: after a grant the pointer is terminal, so a second
//     startPairing opens a fresh session.
//   - terminal states: child decline, TTL expiry, parent decline (rows 4/6/7/8).
//   - SESSION_IN_PROGRESS on start → error with NO destructive delete.
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const CHILD_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const CHILD = { childIndex: 0, name: 'Kid', spendingLimit: 1000 };
const T0 = 1_700_000_000_000;
const PARENT_NAME = 'ParentName';
const RID = 'parentname'; // normalizePairingName(PARENT_NAME)

let nextSessionId = 1;
const mockDb = {
  startPairingSession: jest.fn(async () => `sess-${nextSessionId++}`),
  endPairingSession: jest.fn(async () => true),
  deletePairingHandshake: jest.fn(async () => {}),
  setPairingDoc: jest.fn(async () => true),
  subscribePairingDoc: jest.fn(),
  ownsUniqueNameReservation: jest.fn(async () => true),
};
const mockDeriveChildMnemonic = jest.fn(async () => CHILD_MNEMONIC);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

jest.mock('../../context-store/keys', () => ({
  __esModule: true,
  useKeysContext: () => ({
    accountMnemoinc: 'parent seed words',
    publicKey: 'parent-pub',
  }),
}));

jest.mock('../../context-store/globalContacts', () => ({
  __esModule: true,
  useGlobalContactsInfo: () => ({
    globalContactsInformation: { myProfile: { uniqueName: 'ParentName' } },
  }),
}));

jest.mock('../../app/functions/accounts/childAccounts', () => ({
  __esModule: true,
  deriveChildMnemonic: (...args) => mockDeriveChildMnemonic(...args),
}));

jest.mock('../../app/functions/crashlyticsLogs', () => ({
  __esModule: true,
  crashlyticsRecordErrorReport: jest.fn(),
}));

jest.mock('../../db', () => ({
  __esModule: true,
  startPairingSession: (...a) => mockDb.startPairingSession(...a),
  endPairingSession: (...a) => mockDb.endPairingSession(...a),
  deletePairingHandshake: (...a) => mockDb.deletePairingHandshake(...a),
  setPairingDoc: (...a) => mockDb.setPairingDoc(...a),
  subscribePairingDoc: (...a) => mockDb.subscribePairingDoc(...a),
  ownsUniqueNameReservation: (...a) => mockDb.ownsUniqueNameReservation(...a),
}));

const {
  ChildPairingProvider,
  useChildPairing,
} = require('../../context-store/childPairingContext');
const {
  computeSAS,
  deriveSharedX,
  deriveSeedKey,
  decryptSeedPayload,
  makeChildEphKey,
} = require('../../app/functions/accounts/childPairing');

let renderer;
let api;
let listeners;
let childEph;

function Harness() {
  api = useChildPairing();
  return null;
}

async function flush(times = 12) {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

async function mount() {
  await act(async () => {
    renderer = ReactTestRenderer.create(
      React.createElement(
        ChildPairingProvider,
        null,
        React.createElement(Harness),
      ),
    );
    await flush();
  });
}

async function runStartPairing() {
  await act(async () => {
    const p = api.startPairing(CHILD);
    await flush();
    await p;
    await flush();
  });
  expect(api.status).toBe('waiting');
}

async function reachConfirm() {
  await runStartPairing();
  await act(async () => {
    listeners.childHello({ childEphPub: childEph.pub });
    await flush();
  });
  expect(api.status).toBe('confirm');
}

// The sessionId the provider threaded into its live wire calls (the async
// startPairingSession return, resolved). Read it off the latest subscription.
function lastSessionId() {
  const calls = mockDb.subscribePairingDoc.mock.calls.filter(c => c[0] === RID);
  return calls[calls.length - 1][1];
}

// setPairingDoc(rid, sessionId, party, data) → data is index [3].
function findDocCall(party) {
  return mockDb.setPairingDoc.mock.calls.find(([, , p]) => p === party);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(T0);
  jest.clearAllMocks();
  nextSessionId = 1;
  listeners = {};
  childEph = makeChildEphKey();
  mockDb.subscribePairingDoc.mockImplementation((rid, sessionId, party, onData) => {
    listeners[party] = onData;
    return jest.fn(() => {
      delete listeners[party];
    });
  });
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  jest.useRealTimers();
});

describe('childPairingContext — happy path', () => {
  test('startPairing → childHello → confirm → Match → childConfirm → done', async () => {
    await mount();
    await reachConfirm();

    // Session opened under the parent's own username, with a fresh sessionId.
    expect(mockDb.startPairingSession).toHaveBeenCalledWith(
      RID,
      'parent-pub',
      expect.objectContaining({ commit: expect.any(String) }),
    );

    const parentEphPub = findDocCall('parentReveal')[3].parentEphPub;
    const childSharedX = deriveSharedX(childEph.priv, parentEphPub);
    expect(api.sas).toBe(computeSAS(childSharedX, childEph.pub, parentEphPub));

    await act(async () => {
      api.confirmMatch();
      await flush();
    });
    expect(api.status).toBe('granting');

    await act(async () => {
      listeners.childConfirm();
      await flush();
    });
    expect(api.status).toBe('done');

    const grant = findDocCall('grant');
    expect(grant).toBeTruthy();
    const payload = decryptSeedPayload(deriveSeedKey(childSharedX), {
      iv: grant[3].iv,
      ct: grant[3].ciphertext,
      tag: grant[3].tag,
    });
    expect(payload).toMatchObject({
      v: 1,
      mnemonic: CHILD_MNEMONIC,
      name: 'Kid',
      spendingLimit: 1000,
      childIndex: 0,
    });
    // Grant delivered → pointer marked terminal, handshake NOT deleted (child
    // still needs to read the grant doc).
    expect(mockDb.endPairingSession).toHaveBeenCalledWith(RID, lastSessionId());
    expect(mockDb.deletePairingHandshake).not.toHaveBeenCalled();
  });

  test('re-pair back-to-back opens a fresh session after a grant', async () => {
    await mount();
    await reachConfirm();
    const firstSession = lastSessionId();

    await act(async () => {
      api.confirmMatch();
      await flush();
    });
    await act(async () => {
      listeners.childConfirm();
      await flush();
    });
    expect(api.status).toBe('done');

    // Immediately re-pair a second child (same parent username). The done screen
    // resets the session; because the pointer is already terminal, the second
    // startPairingSession is not blocked and opens a fresh session.
    await act(async () => {
      await api.resetSession();
      await flush();
    });
    childEph = makeChildEphKey();
    await reachConfirm();
    const secondSession = lastSessionId();

    expect(mockDb.startPairingSession).toHaveBeenCalledTimes(2);
    expect(secondSession).not.toBe(firstSession);
    expect(api.status).toBe('confirm');
  });
});

describe('childPairingContext — terminal states', () => {
  test('child rejects while modal open → error, stale Match no-ops', async () => {
    await mount();
    await reachConfirm();
    const sessionId = lastSessionId();

    await act(async () => {
      listeners.cancel();
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe(
      'settings.childAccounts.pairing.declinedByChild',
    );
    // Session dead: listeners torn down, pointer marked terminal, own docs deleted.
    expect(listeners.cancel).toBeUndefined();
    expect(listeners.childHello).toBeUndefined();
    expect(mockDb.endPairingSession).toHaveBeenCalledWith(RID, sessionId);
    expect(mockDb.deletePairingHandshake).toHaveBeenCalledWith(RID, sessionId);

    await act(async () => {
      api.confirmMatch();
      await flush();
    });
    expect(api.status).toBe('error');
    expect(mockDb.setPairingDoc).not.toHaveBeenCalledWith(
      RID,
      sessionId,
      'grant',
      expect.anything(),
    );
  });

  test('TTL expiry while modal open → expired', async () => {
    await mount();
    await reachConfirm();
    const sessionId = lastSessionId();

    await act(async () => {
      jest.advanceTimersByTime(180001);
      await flush();
    });
    expect(api.status).toBe('expired');
    expect(mockDb.endPairingSession).toHaveBeenCalledWith(RID, sessionId);
    expect(mockDb.deletePairingHandshake).toHaveBeenCalledWith(RID, sessionId);
  });

  test("parent Don't Match from confirm → idle + cancel doc, terminal mark, no delete", async () => {
    await mount();
    await reachConfirm();
    const sessionId = lastSessionId();

    await act(async () => {
      await api.declineMatch();
      await flush();
    });
    expect(api.status).toBe('idle');
    expect(mockDb.setPairingDoc).toHaveBeenCalledWith(
      RID,
      sessionId,
      'cancel',
      expect.objectContaining({ v: 1 }),
    );
    // Declined: pointer marked terminal, but own docs left for the peer to read.
    expect(mockDb.endPairingSession).toHaveBeenCalledWith(RID, sessionId);
    expect(mockDb.deletePairingHandshake).not.toHaveBeenCalled();
  });
});

describe('childPairingContext — start guards', () => {
  test('SESSION_IN_PROGRESS on start → error, no destructive delete', async () => {
    mockDb.startPairingSession.mockRejectedValueOnce(
      new Error('SESSION_IN_PROGRESS'),
    );
    await mount();

    await act(async () => {
      const p = api.startPairing(CHILD);
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe('settings.childAccounts.pairing.startFailed');
    // sessionRef was never set → nothing torn down.
    expect(mockDb.deletePairingHandshake).not.toHaveBeenCalled();
    expect(mockDb.endPairingSession).not.toHaveBeenCalled();
  });

  test('unowned/unreserved name → clear notOwner error, no session opened', async () => {
    mockDb.ownsUniqueNameReservation.mockResolvedValueOnce(false);
    await mount();

    await act(async () => {
      const p = api.startPairing(CHILD);
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe('settings.childAccounts.pairing.notOwner');
    // Blocked before touching the pointer transaction.
    expect(mockDb.startPairingSession).not.toHaveBeenCalled();
  });
});
