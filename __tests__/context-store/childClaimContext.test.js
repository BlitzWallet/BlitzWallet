/* eslint-env jest */
// ---------------------------------------------------------------------------
// childClaimContext — child-side claim state machine (username rendezvous).
//
// Drives the real provider with mocked `../db` helpers and injects Firestore
// events through captured callbacks. The child now types the parent's username,
// reads the pointer (getPairingPointer) to learn the live sessionId + commit,
// joins that session's childHello slot, and watches the pointer for the parent
// leaving/replacing/ending the session.
//   - happy path: submitName → parentReveal → confirm → confirmMatch → grant →
//     done (imported seed, session handshake deleted under sessionId).
//   - commit mismatch → tamper; parent cancel → error; pointer terminal /
//     sessionId change / deletion → expired; TTL expiry from joining/awaiting.
//   - childHello denial → pointer re-read → rotate (retry new sessionId) vs
//     squat (slotTaken).
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const CHILD_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PARENT_NAME = 'ParentName';
const RID = 'parentname';
const TTL = 180000;

const mockSetAccountMnemonic = jest.fn();
const mockDb = {
  getPairingPointer: jest.fn(),
  getPairingDoc: jest.fn(),
  setPairingDoc: jest.fn(async () => true),
  subscribePairingDoc: jest.fn(),
  subscribePairingPointer: jest.fn(),
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
  getPairingPointer: (...a) => mockDb.getPairingPointer(...a),
  getPairingDoc: (...a) => mockDb.getPairingDoc(...a),
  setPairingDoc: (...a) => mockDb.setPairingDoc(...a),
  subscribePairingDoc: (...a) => mockDb.subscribePairingDoc(...a),
  subscribePairingPointer: (...a) => mockDb.subscribePairingPointer(...a),
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
} = require('../../app/functions/accounts/childPairing');

let renderer;
let api;
let listeners;
let pointerListener;
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

async function submitName() {
  await act(async () => {
    const p = api.submitName(PARENT_NAME);
    await flush();
    await p;
    await flush();
  });
  expect(api.status).toBe('joining');
}

async function reachConfirm() {
  await submitName();
  await act(async () => {
    listeners.parentReveal({ parentEphPub: parentEph.pub });
    await flush();
  });
  expect(api.status).toBe('confirm');
}

// childHello written under (rid, sessionId, party, data) → data is index [3].
// Use the LAST childHello write (a join race may retry under a new sessionId).
function childHelloCalls() {
  return mockDb.setPairingDoc.mock.calls.filter(
    ([r, , p]) => r === RID && p === 'childHello',
  );
}

function sessionEphPub() {
  const calls = childHelloCalls();
  return calls[calls.length - 1][3].childEphPub;
}

function joinedSessionId() {
  const calls = childHelloCalls();
  return calls[calls.length - 1][1];
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

function activePointer(sessionId = 'sess-1') {
  return {
    v: 1,
    sessionId,
    commit: makeKeyCommitment(parentEph.pub),
    parentWalletPub: 'parent-pub',
    name: RID,
    status: 'active',
    expiresAt: Date.now() + TTL,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  listeners = {};
  pointerListener = null;
  parentEph = makeChildEphKey();
  mockDb.getPairingPointer.mockImplementation(async () => activePointer());
  mockDb.setPairingDoc.mockImplementation(async () => true);
  mockDb.subscribePairingDoc.mockImplementation((rid, sessionId, party, onData) => {
    listeners[party] = onData;
    return jest.fn(() => {
      delete listeners[party];
    });
  });
  mockDb.subscribePairingPointer.mockImplementation((rid, onData) => {
    pointerListener = onData;
    return jest.fn(() => {
      pointerListener = null;
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

describe('childClaimContext — happy path', () => {
  test('submitName → parentReveal → confirm → confirmMatch → grant → done', async () => {
    await mount();
    await reachConfirm();
    const childSessionPub = sessionEphPub();
    const sessionId = joinedSessionId();

    expect(api.sas).toBe(
      computeSAS(
        deriveSharedX(parentEph.priv, childSessionPub),
        childSessionPub,
        parentEph.pub,
      ),
    );
    expect(mockDb.setPairingDoc).toHaveBeenCalledWith(
      RID,
      sessionId,
      'childHello',
      expect.objectContaining({ v: 1, childEphPub: childSessionPub }),
    );

    await act(async () => {
      const p = api.confirmMatch();
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('awaiting');
    expect(mockDb.setPairingDoc).toHaveBeenCalledWith(
      RID,
      sessionId,
      'childConfirm',
      expect.objectContaining({ v: 1 }),
    );

    const enc = grantPayload();
    await act(async () => {
      listeners.grant({ ciphertext: enc.ct, iv: enc.iv, tag: enc.tag });
      await flush();
    });
    expect(api.status).toBe('done');
    expect(mockSetAccountMnemonic).toHaveBeenCalledWith(CHILD_MNEMONIC);
    expect(mockDb.deletePairingHandshake).toHaveBeenCalledWith(RID, sessionId);
  });

  test('commit mismatch → tamper error (MITM reveal caught)', async () => {
    await mount();
    await submitName();

    const attacker = makeChildEphKey();
    await act(async () => {
      listeners.parentReveal({ parentEphPub: attacker.pub });
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.tamper');
  });
});

describe('childClaimContext — join races (B-2)', () => {
  test('childHello denied + rotated sessionId → retry under the new session', async () => {
    // First write denied; pointer re-read shows a NEW sessionId (parent re-paired
    // between our read and write); second write succeeds under the new id.
    let helloAttempts = 0;
    mockDb.setPairingDoc.mockImplementation(async (rid, sessionId, party) => {
      if (party === 'childHello') {
        helloAttempts += 1;
        return helloAttempts > 1; // first denied, then allowed
      }
      return true;
    });
    mockDb.getPairingPointer
      .mockImplementationOnce(async () => activePointer('sess-1'))
      .mockImplementationOnce(async () => activePointer('sess-2'));

    await mount();
    await submitName();

    expect(helloAttempts).toBe(2);
    expect(joinedSessionId()).toBe('sess-2');
    expect(api.status).toBe('joining'); // now waiting for parentReveal
  });

  test('childHello denied + same sessionId + foreign hello → slotTaken', async () => {
    mockDb.setPairingDoc.mockImplementation(async (rid, sessionId, party) => {
      if (party === 'childHello') return false; // always denied (squatter won)
      return true;
    });
    mockDb.getPairingDoc.mockResolvedValue({ childEphPub: 'someone-else-pub' });

    await mount();
    await act(async () => {
      const p = api.submitName(PARENT_NAME);
      await flush();
      await p;
      await flush();
    });

    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.slotTaken');
  });
});

describe('childClaimContext — terminal states', () => {
  test('parent cancel → error', async () => {
    await mount();
    await submitName();

    await act(async () => {
      listeners.cancel();
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe(
      'settings.childAccounts.claim.canceledByParent',
    );
  });

  test('pointer sessionId change → expired (B-3)', async () => {
    await mount();
    await submitName();

    await act(async () => {
      pointerListener(activePointer('sess-999'));
      await flush();
    });
    expect(api.status).toBe('expired');
  });

  test('pointer marked terminal → expired (B-3)', async () => {
    await mount();
    await submitName();

    await act(async () => {
      pointerListener({ ...activePointer('sess-1'), status: 'terminal' });
      await flush();
    });
    expect(api.status).toBe('expired');
  });

  test('pointer deleted → expired (B-3)', async () => {
    await mount();
    await submitName();

    await act(async () => {
      pointerListener(null);
      await flush();
    });
    expect(api.status).toBe('expired');
  });

  test('terminal pointer while awaiting the grant is NOT expiry (grant-vs-terminal race)', async () => {
    // Once past SAS (sharedX derived, status awaiting), the parent marks the
    // pointer terminal right AFTER writing the grant so it can re-pair. If that
    // terminal snapshot is processed before the grant snapshot, the child must
    // NOT flip to expired — the grant is still arriving.
    await mount();
    await reachConfirm();
    await act(async () => {
      const p = api.confirmMatch();
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('awaiting');

    // Terminal pointer arrives first — must be ignored, not treated as expiry.
    await act(async () => {
      pointerListener({ ...activePointer('sess-1'), status: 'terminal' });
      await flush();
    });
    expect(api.status).toBe('awaiting');

    // Then the grant lands and the child imports the seed.
    const enc = grantPayload();
    await act(async () => {
      listeners.grant({ ciphertext: enc.ct, iv: enc.iv, tag: enc.tag });
      await flush();
    });
    expect(api.status).toBe('done');
    expect(mockSetAccountMnemonic).toHaveBeenCalledWith(CHILD_MNEMONIC);
  });

  test('TTL expiry while waiting for the reveal → expired', async () => {
    jest.useFakeTimers();
    await mount();
    await submitName();

    await act(async () => {
      jest.advanceTimersByTime(TTL + 1);
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
      jest.advanceTimersByTime(TTL + 1);
      await flush();
    });
    expect(api.status).toBe('expired');
  });

  test('confirmMatch no-ops from a terminal state (symmetry guard)', async () => {
    await mount();
    await submitName();
    const sessionId = joinedSessionId();

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
    expect(mockDb.setPairingDoc).not.toHaveBeenCalledWith(
      RID,
      sessionId,
      'childConfirm',
      expect.anything(),
    );
    expect(mockDb.subscribePairingDoc).not.toHaveBeenCalledWith(
      RID,
      sessionId,
      'grant',
      expect.any(Function),
    );
  });

  test('notFound when no live pointer exists', async () => {
    jest.useFakeTimers();
    mockDb.getPairingPointer.mockResolvedValue(null);
    await mount();

    await act(async () => {
      const p = api.submitName(PARENT_NAME);
      // The retry loop sleeps 800ms between attempts (6 tries); interleave
      // flush + advance so each setTimeout resolves and the next is created.
      for (let i = 0; i < 8; i++) {
        await flush();
        jest.advanceTimersByTime(800);
      }
      await p;
      await flush();
    });
    expect(api.status).toBe('idle');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.notFound');
  });
});
