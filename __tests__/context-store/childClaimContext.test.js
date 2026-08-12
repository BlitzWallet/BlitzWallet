/* eslint-env jest */
// ---------------------------------------------------------------------------
// childClaimContext — child-side claim state machine.
//
// Drives the real provider with mocked `../db` handshake helpers and injects
// Firestore events through captured subscribePairingDoc callbacks, then asserts
// the child half of the pairing transition matrix:
//   - happy path: submitCode → parentReveal → confirm → confirmMatch →
//     childConfirm → grant → done (imported seed, handshake deleted).
//   - commit mismatch → tamper error; parent cancel → error; parentHello
//     deletion → expired; TTL expiry from joining and from awaiting.
//   - confirmMatch no-ops from a terminal state (symmetry guard).
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const CHILD_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PAIRING_CODE = '123456';

const mockSetAccountMnemonic = jest.fn();
const mockDb = {
  getPairingDoc: jest.fn(),
  setPairingDoc: jest.fn(async () => true),
  subscribePairingDoc: jest.fn(),
  subscribePairingDocDeleted: jest.fn(),
  deletePairingHandshake: jest.fn(async () => {}),
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

jest.mock('../../context-store/keys', () => ({
  __esModule: true,
  useKeysContext: () => ({ setAccountMnemonic: mockSetAccountMnemonic }),
}));

jest.mock('../../db/initializeFirebase', () => ({
  __esModule: true,
  firebaseAuth: { currentUser: { uid: 'child-uid' } },
}));

jest.mock('../../db', () => ({
  __esModule: true,
  deletePairingHandshake: (...a) => mockDb.deletePairingHandshake(...a),
  getPairingDoc: (...a) => mockDb.getPairingDoc(...a),
  setPairingDoc: (...a) => mockDb.setPairingDoc(...a),
  subscribePairingDoc: (...a) => mockDb.subscribePairingDoc(...a),
  subscribePairingDocDeleted: (...a) => mockDb.subscribePairingDocDeleted(...a),
}));

const {
  ChildClaimProvider,
  useChildClaim,
} = require('../../context-store/childClaimContext');
const {
  computeSAS,
  deriveSharedX,
  deriveSeedKey,
  encryptSeedPayload,
  makeChildEphKey,
  makeKeyCommitment,
  rendezvousId,
} = require('../../app/functions/accounts/childPairing');

let renderer;
let api;
let listeners;
let deletedListeners;
let parentEph;

function Harness() {
  api = useChildClaim();
  return null;
}

async function flush(times = 12) {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

async function mount() {
  await act(async () => {
    renderer = ReactTestRenderer.create(
      React.createElement(
        ChildClaimProvider,
        null,
        React.createElement(Harness),
      ),
    );
    await flush();
  });
}

async function submitCode() {
  await act(async () => {
    const p = api.submitCode(PAIRING_CODE);
    await flush();
    await p;
    await flush();
  });
  expect(api.status).toBe('joining');
}

async function reachConfirm() {
  await submitCode();
  await act(async () => {
    listeners.parentReveal({ parentEphPub: parentEph.pub });
    await flush();
  });
  expect(api.status).toBe('confirm');
}

function pairingRid() {
  return rendezvousId(PAIRING_CODE);
}

// The child's session ephemeral pubkey, as written to the childHello doc. The
// provider creates the keypair internally; the parent-side ECDH derivation
// (parentEph.priv × childSessionPub) still yields the same sharedX.
function sessionEphPub() {
  const childHelloCall = mockDb.setPairingDoc.mock.calls.find(
    ([r, p]) => r === pairingRid() && p === 'childHello',
  );
  return childHelloCall[2].childEphPub;
}

function grantPayload() {
  const sharedX = deriveSharedX(parentEph.priv, sessionEphPub());
  return encryptSeedPayload(deriveSeedKey(sharedX), {
    v: 1,
    mnemonic: CHILD_MNEMONIC,
    name: 'Kid',
    spendingLimit: 1000,
    childIndex: 0,
    grantedAt: Date.now(),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  listeners = {};
  deletedListeners = {};
  parentEph = makeChildEphKey();
  mockDb.getPairingDoc.mockResolvedValue({
    commit: makeKeyCommitment(parentEph.pub),
  });
  mockDb.subscribePairingDoc.mockImplementation((rid, party, onData) => {
    listeners[party] = onData;
    return jest.fn(() => {
      delete listeners[party];
    });
  });
  mockDb.subscribePairingDocDeleted.mockImplementation(
    (rid, party, onDeleted) => {
      deletedListeners[party] = onDeleted;
      return jest.fn(() => {
        delete deletedListeners[party];
      });
    },
  );
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  jest.useRealTimers();
});

describe('childClaimContext — happy path', () => {
  test('submitCode → parentReveal → confirm → confirmMatch → grant → done', async () => {
    await mount();
    await reachConfirm();
    const rid = pairingRid();
    const childSessionPub = sessionEphPub();

    // SAS matches what the parent computes from its own ECDH (same sharedX via
    // parentEph.priv × the child's session pubkey).
    expect(api.sas).toBe(
      computeSAS(
        deriveSharedX(parentEph.priv, childSessionPub),
        childSessionPub,
        parentEph.pub,
      ),
    );
    expect(mockDb.setPairingDoc).toHaveBeenCalledWith(
      rid,
      'childHello',
      expect.objectContaining({ v: 1, childEphPub: childSessionPub }),
    );

    // Child confirms the match → childConfirm written, waiting for the grant.
    await act(async () => {
      const p = api.confirmMatch();
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('awaiting');
    expect(mockDb.setPairingDoc).toHaveBeenCalledWith(
      rid,
      'childConfirm',
      expect.objectContaining({ v: 1 }),
    );

    // Parent delivers the encrypted grant → seed imported, session torn down.
    const enc = grantPayload();
    await act(async () => {
      listeners.grant({ ciphertext: enc.ct, iv: enc.iv, tag: enc.tag });
      await flush();
    });
    expect(api.status).toBe('done');
    expect(mockSetAccountMnemonic).toHaveBeenCalledWith(CHILD_MNEMONIC);
    expect(mockDb.deletePairingHandshake).toHaveBeenCalledWith(rid);
  });

  test('commit mismatch → tamper error (MITM reveal caught)', async () => {
    await mount();
    await submitCode();

    const attacker = makeChildEphKey();
    await act(async () => {
      listeners.parentReveal({ parentEphPub: attacker.pub });
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.tamper');
  });
});

describe('childClaimContext — terminal states', () => {
  test('parent cancel → error', async () => {
    await mount();
    await submitCode();

    await act(async () => {
      listeners.cancel();
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe(
      'settings.childAccounts.claim.canceledByParent',
    );
  });

  test('parentHello deleted → expired', async () => {
    await mount();
    await submitCode();

    await act(async () => {
      deletedListeners.parentHello();
      await flush();
    });
    expect(api.status).toBe('expired');
  });

  test('TTL expiry while waiting for the reveal → expired', async () => {
    jest.useFakeTimers();
    await mount();
    await submitCode();

    await act(async () => {
      jest.advanceTimersByTime(180001);
      await flush();
    });
    expect(api.status).toBe('expired');
  });

  test('TTL expiry while awaiting the grant → expired', async () => {
    jest.useFakeTimers();
    await mount();
    await reachConfirm();

    await act(async () => {
      const p = api.confirmMatch();
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('awaiting');

    await act(async () => {
      jest.advanceTimersByTime(180001);
      await flush();
    });
    expect(api.status).toBe('expired');
  });

  test('confirmMatch no-ops from a terminal state (symmetry guard)', async () => {
    await mount();
    await submitCode();
    const rid = pairingRid();

    await act(async () => {
      listeners.cancel();
      await flush();
    });
    expect(api.status).toBe('error');

    await act(async () => {
      const p = api.confirmMatch();
      await flush();
      await p;
    });
    expect(api.status).toBe('error');
    // No childConfirm write and no grant subscription from the dead session.
    expect(mockDb.setPairingDoc).not.toHaveBeenCalledWith(
      rid,
      'childConfirm',
      expect.anything(),
    );
    expect(mockDb.subscribePairingDoc).not.toHaveBeenCalledWith(
      rid,
      'grant',
      expect.any(Function),
    );
  });
});
