/* eslint-env jest */
// ---------------------------------------------------------------------------
// childPairingContext — parent-side pairing state machine.
//
// Drives the real provider with mocked `../db` handshake helpers and injects
// Firestore events through captured subscribePairingDoc callbacks, then asserts
// the documented transition matrix (see the pairing correctness review):
//   - happy path: startPairing → childHello → confirm → Match → childConfirm
//     → done, and the grant ciphertext actually decrypts under the child's
//     ECDH key (rows 1-3).
//   - regression: child "Don't Match" while the parent confirmation modal is
//     open must land on `error` AND make a stale `confirmMatch()` a no-op —
//     never `error → granting` (row 6).
//   - regression: TTL expiry while the modal is open lands on `expired` and
//     `confirmMatch()` no-ops (row 7).
//   - parent Don't Match from confirm/granting (rows 4, 8), late cancel after
//     grant (row 14), duplicate childConfirm (row 13), double Match tap
//     (row 12).
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const CHILD_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const CHILD = { childIndex: 0, name: 'Kid', spendingLimit: 1000 };
const T0 = 1_700_000_000_000;

const mockDb = {
  createParentHelloViaProxy: jest.fn(async () => true),
  deletePairingHandshake: jest.fn(async () => {}),
  setPairingDoc: jest.fn(async () => true),
  subscribePairingDoc: jest.fn(),
};
const mockDeriveChildMnemonic = jest.fn(async () => CHILD_MNEMONIC);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

jest.mock('../../context-store/keys', () => ({
  __esModule: true,
  useKeysContext: () => ({ accountMnemoinc: 'parent seed words' }),
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
  createParentHelloViaProxy: (...a) => mockDb.createParentHelloViaProxy(...a),
  deletePairingHandshake: (...a) => mockDb.deletePairingHandshake(...a),
  setPairingDoc: (...a) => mockDb.setPairingDoc(...a),
  subscribePairingDoc: (...a) => mockDb.subscribePairingDoc(...a),
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

// startPairing paces itself with a ~1s delay so the code is readable on
// screen; under fake timers we fire that delay explicitly.
async function runStartPairing() {
  await act(async () => {
    const p = api.startPairing(CHILD);
    await flush();
    jest.advanceTimersByTime(1001);
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

function pairingRid() {
  return mockDb.createParentHelloViaProxy.mock.calls[0][0];
}

function findDocCall(rid, party) {
  return mockDb.setPairingDoc.mock.calls.find(
    ([r, p]) => r === rid && p === party,
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(T0);
  jest.clearAllMocks();
  listeners = {};
  childEph = makeChildEphKey();
  mockDb.subscribePairingDoc.mockImplementation((rid, party, onData) => {
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
  test('startPairing → childHello → confirm → Match → childConfirm → done (rows 1-3)', async () => {
    await mount();
    await reachConfirm();

    const rid = pairingRid();
    const parentEphPub = findDocCall(rid, 'parentReveal')[2].parentEphPub;
    // SAS matches what the child would compute from its own ECDH.
    const childSharedX = deriveSharedX(childEph.priv, parentEphPub);
    expect(api.sas).toBe(computeSAS(childSharedX, childEph.pub, parentEphPub));

    // Parent presses Match (row 3: parent first). Status becomes granting.
    await act(async () => {
      api.confirmMatch();
      await flush();
    });
    expect(api.status).toBe('granting');

    // Child's childConfirm lands (rows 2/3: fires immediately if it already
    // confirmed, or on the snapshot). Grant is delivered and encrypted under
    // the ECDH key the child can derive.
    await act(async () => {
      listeners.childConfirm();
      await flush();
    });
    expect(api.status).toBe('done');

    const grant = findDocCall(rid, 'grant');
    expect(grant).toBeTruthy();
    const payload = decryptSeedPayload(deriveSeedKey(childSharedX), {
      iv: grant[2].iv,
      ct: grant[2].ciphertext,
      tag: grant[2].tag,
    });
    expect(payload).toMatchObject({
      v: 1,
      mnemonic: CHILD_MNEMONIC,
      name: 'Kid',
      spendingLimit: 1000,
      childIndex: 0,
    });
    // The delivered grant means the seed was wiped from the parent session.
    expect(mockDb.deletePairingHandshake).not.toHaveBeenCalled();
  });

  test('late cancel after grant delivered is a no-op (row 14)', async () => {
    await mount();
    await reachConfirm();
    const rid = pairingRid();

    await act(async () => {
      api.confirmMatch();
      await flush();
    });
    await act(async () => {
      listeners.childConfirm();
      await flush();
    });
    expect(api.status).toBe('done');

    // A stale cancel snapshot (child pressed Don't Match after the grant
    // landed) must not flip the parent to error.
    await act(async () => {
      listeners.cancel();
      await flush();
    });
    expect(api.status).toBe('done');
    expect(api.errorMessage).toBe('');
    expect(findDocCall(rid, 'grant')).toBeTruthy();
  });

  test('duplicate childConfirm delivers exactly one grant (row 13)', async () => {
    await mount();
    await reachConfirm();
    const rid = pairingRid();

    await act(async () => {
      api.confirmMatch();
      await flush();
    });
    const fireChildConfirm = listeners.childConfirm;
    await act(async () => {
      fireChildConfirm();
      await flush();
    });
    expect(api.status).toBe('done');

    // Second snapshot: the session already granted — no second grant write, no
    // post-done error.
    await act(async () => {
      fireChildConfirm();
      await flush();
    });
    expect(api.status).toBe('done');
    const grantCalls = mockDb.setPairingDoc.mock.calls.filter(
      ([r, p]) => r === rid && p === 'grant',
    );
    expect(grantCalls.length).toBe(1);
  });

  test('double Match tap only subscribes once (row 12)', async () => {
    await mount();
    await reachConfirm();
    const rid = pairingRid();

    await act(async () => {
      api.confirmMatch();
      await flush();
    });
    expect(api.status).toBe('granting');

    // Second tap after the state flipped to granting must no-op.
    await act(async () => {
      api.confirmMatch();
      await flush();
    });
    expect(api.status).toBe('granting');
    const confirmSubs = mockDb.subscribePairingDoc.mock.calls.filter(
      ([r, p]) => r === rid && p === 'childConfirm',
    );
    expect(confirmSubs.length).toBe(1);
  });
});

describe('childPairingContext — terminal states', () => {
  test('child rejects while modal open → error, stale Match no-ops (row 6)', async () => {
    await mount();
    await reachConfirm();
    const rid = pairingRid();

    // The confirmation modal is open: status stays `confirm`, no state change.
    // The child presses Don't Match → the cancel doc arrives.
    await act(async () => {
      listeners.cancel();
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe(
      'settings.childAccounts.pairing.declinedByChild',
    );
    // The session is dead: listeners torn down, docs cleaned up, seed wiped.
    expect(listeners.cancel).toBeUndefined();
    expect(listeners.childHello).toBeUndefined();
    expect(mockDb.deletePairingHandshake).toHaveBeenCalledWith(rid);

    // The stale Match press from the still-mounted modal must be a no-op — the
    // invalid `error → granting` transition is gone.
    await act(async () => {
      api.confirmMatch();
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe(
      'settings.childAccounts.pairing.declinedByChild',
    );
    expect(mockDb.subscribePairingDoc).not.toHaveBeenCalledWith(
      rid,
      'childConfirm',
      expect.any(Function),
    );
    expect(mockDb.setPairingDoc).not.toHaveBeenCalledWith(
      rid,
      'grant',
      expect.anything(),
    );
  });

  test('TTL expiry while modal open → expired, stale Match no-ops (row 7)', async () => {
    await mount();
    await reachConfirm();
    const rid = pairingRid();

    // 3-minute handshake TTL elapses while the confirmation modal is open.
    await act(async () => {
      jest.advanceTimersByTime(180001);
      await flush();
    });
    expect(api.status).toBe('expired');
    expect(mockDb.deletePairingHandshake).toHaveBeenCalledWith(rid);

    // Stale Match press no-ops (session is nulled; status guard also blocks).
    await act(async () => {
      api.confirmMatch();
      await flush();
    });
    expect(api.status).toBe('expired');
    expect(mockDb.subscribePairingDoc).not.toHaveBeenCalledWith(
      rid,
      'childConfirm',
      expect.any(Function),
    );
  });

  test("parent Don't Match from confirm → idle + cancel doc, no handshake delete (row 4)", async () => {
    await mount();
    await reachConfirm();
    const rid = pairingRid();

    await act(async () => {
      await api.declineMatch();
      await flush();
    });
    expect(api.status).toBe('idle');
    expect(mockDb.setPairingDoc).toHaveBeenCalledWith(
      rid,
      'cancel',
      expect.objectContaining({ v: 1 }),
    );
    // Declined sessions leave their docs for the peer to read; TTL cleans up.
    expect(mockDb.deletePairingHandshake).not.toHaveBeenCalled();
  });

  test("parent Don't Match while granting → idle + cancel doc (row 8)", async () => {
    await mount();
    await reachConfirm();
    const rid = pairingRid();

    await act(async () => {
      api.confirmMatch();
      await flush();
    });
    expect(api.status).toBe('granting');

    await act(async () => {
      await api.declineMatch();
      await flush();
    });
    expect(api.status).toBe('idle');
    expect(mockDb.setPairingDoc).toHaveBeenCalledWith(
      rid,
      'cancel',
      expect.objectContaining({ v: 1 }),
    );
  });
});
