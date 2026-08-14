/* eslint-env jest */
// ---------------------------------------------------------------------------
// childClaimContext — child-side claim state machine (JIT sessions).
//
// Drives the real provider with mocked `../db` helpers and injects Firestore
// events through captured callbacks. The child reads the parent's pointer for
// sessionId + commit, atomically claims the session (joinPairingSession), then
// watches the SESSION doc for cancellation/deletion — the pointer no longer
// drives anything after discovery.
//   - happy path: submitName → parentReveal → confirm → confirmMatch →
//     childConfirm → grant → done (decrypt-success is the terminal; the
//     session's COMPLETED marker is never observed, D5).
//   - commit mismatch → tamper; session CANCELLED → canceled; session deleted /
//     deadline passed → derived expired.
//   - join denial → the single "start a new pairing" copy (D4), never an
//     "already claimed" diagnosis.
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const CHILD_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PARENT_NAME = 'ParentName';
const RID = 'parentname';
const STATE_TTL = 180000; // per-state server deadline
const PAIRING_EXPIRY_SLACK_MS = 10 * 1000; // passive-fallback slack (source: childClaimContext.js)
const T0 = 1_700_000_000_000;

const mockSetAccountMnemonic = jest.fn();
const mockDb = {
  getPairingPointer: jest.fn(),
  joinPairingSession: jest.fn(async () => true),
  setPairingDoc: jest.fn(async () => true),
  subscribePairingDoc: jest.fn(),
  subscribePairingSession: jest.fn(),
  deletePairingHandshake: jest.fn(async () => {}),
  cancelPairingSession: jest.fn(async () => true),
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
  cancelPairingSession: (...a) => mockDb.cancelPairingSession(...a),
  getPairingPointer: (...a) => mockDb.getPairingPointer(...a),
  joinPairingSession: (...a) => mockDb.joinPairingSession(...a),
  setPairingDoc: (...a) => mockDb.setPairingDoc(...a),
  subscribePairingDoc: (...a) => mockDb.subscribePairingDoc(...a),
  subscribePairingSession: (...a) => mockDb.subscribePairingSession(...a),
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
let parentEph;

// The serverTimestamp objects the session snapshot carries (only .toMillis()
// is read by the provider).
const ts = ms => ({ toMillis: () => ms });

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
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(T0);
  jest.clearAllMocks();
  listeners = {};
  parentEph = makeChildEphKey();
  mockDb.getPairingPointer.mockImplementation(async () => activePointer());
  mockDb.setPairingDoc.mockImplementation(async () => true);
  mockDb.subscribePairingDoc.mockImplementation(
    (rid, sessionId, party, onData) => {
      listeners[party] = onData;
      return jest.fn(() => {
        delete listeners[party];
      });
    },
  );
  mockDb.subscribePairingSession.mockImplementation(
    (rid, sessionId, onData) => {
      listeners.session = onData;
      return jest.fn(() => {
        delete listeners.session;
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
    expect(mockDb.joinPairingSession).toHaveBeenCalledWith(
      RID,
      sessionId,
      'child-uid',
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

    // The child's terminal is a successful decrypt (D5): the session's
    // COMPLETED marker is never observed — the grant alone lands `done`.
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

  test('curve-invalid parentReveal pubkey → tamper error, dead session cancelled (no crash)', async () => {
    // A 64-char hex string that is not a valid curve point passes the
    // commitment check (it hashes to the expected value) but must be rejected
    // by the shared-secret derivation instead of crashing the listener.
    mockDb.getPairingPointer.mockImplementation(async () => ({
      ...activePointer(),
      commit: makeKeyCommitment('00'.repeat(32)),
    }));
    await mount();
    await submitName();

    await act(async () => {
      listeners.parentReveal({ parentEphPub: '00'.repeat(32) });
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.tamper');
    // The dead session is actively cancelled and our handshake docs deleted.
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(
      RID,
      joinedSessionId(),
    );
    expect(mockDb.deletePairingHandshake).toHaveBeenCalledWith(
      RID,
      joinedSessionId(),
    );
  });
});

describe('childClaimContext — join outcomes (D4)', () => {
  test('joinPairingSession denial → one "start a new pairing" copy, never "already claimed"', async () => {
    mockDb.joinPairingSession.mockResolvedValueOnce(false);
    await mount();

    await act(async () => {
      const p = api.submitName(PARENT_NAME);
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('idle');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.askToRestart');
    // No diagnosis of claimed-vs-dead, and no hello attempted on a denied claim.
    expect(mockDb.setPairingDoc).not.toHaveBeenCalled();
  });

  test('no live pointer → same "start a new pairing" copy', async () => {
    mockDb.getPairingPointer.mockResolvedValue(null);
    await mount();

    await act(async () => {
      const p = api.submitName(PARENT_NAME);
      // The pointer retry loop sleeps 800ms between attempts (6 tries);
      // interleave flush + advance so each setTimeout resolves and the next is
      // created.
      for (let i = 0; i < 8; i++) {
        await flush();
        jest.advanceTimersByTime(800);
      }
      await p;
      await flush();
    });
    expect(api.status).toBe('idle');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.askToRestart');
  });
});

describe('childClaimContext — terminal states', () => {
  test('parent cancel (session CANCELLED) → error', async () => {
    await mount();
    await submitName();

    await act(async () => {
      listeners.session({ status: 'CANCELLED' });
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe(
      'settings.childAccounts.claim.canceledByParent',
    );
  });

  test('session doc deleted (TTL GC) → derived expired', async () => {
    await mount();
    await submitName();

    await act(async () => {
      listeners.session(null);
      await flush();
    });
    expect(api.status).toBe('expired');
  });

  test('COMPLETED is ignored while awaiting the grant (D5) — grant still lands done', async () => {
    await mount();
    await reachConfirm();
    await act(async () => {
      const p = api.confirmMatch();
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('awaiting');

    // The parent's best-effort COMPLETED marker must not read as success OR
    // failure — the child waits for the grant's AES-GCM tag.
    await act(async () => {
      listeners.session({ status: 'COMPLETED', completedAt: ts(T0) });
      await flush();
    });
    expect(api.status).toBe('awaiting');

    const enc = grantPayload();
    await act(async () => {
      listeners.grant({ ciphertext: enc.ct, iv: enc.iv, tag: enc.tag });
      await flush();
    });
    expect(api.status).toBe('done');
    expect(mockSetAccountMnemonic).toHaveBeenCalledWith(CHILD_MNEMONIC);
  });

  test('rules-denied childConfirm write surfaces expired (D2)', async () => {
    mockDb.setPairingDoc.mockImplementation(async (r, s, party) =>
      party === 'childConfirm' ? false : true,
    );
    await mount();
    await reachConfirm();

    await act(async () => {
      const p = api.confirmMatch();
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('expired');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.expired');
    // No grant subscription started on a denied confirm.
    expect(listeners.grant).toBeUndefined();
  });

  test('passive expiry fallback while waiting for the reveal → cancel + delete', async () => {
    await mount();
    await submitName();

    // Anchor to the server-written joinedAt.
    await act(async () => {
      listeners.session({ status: 'JOINED', joinedAt: ts(T0) });
      await flush();
    });
    await act(async () => {
      jest.advanceTimersByTime(STATE_TTL + PAIRING_EXPIRY_SLACK_MS + 1);
      await flush();
    });
    expect(api.status).toBe('expired');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.expired');
    // Active kill: the session is cancelled and our own handshake docs deleted.
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(
      RID,
      joinedSessionId(),
    );
    expect(mockDb.deletePairingHandshake).toHaveBeenCalledWith(
      RID,
      joinedSessionId(),
    );
  });

  test('passive expiry fallback while awaiting the grant → cancel + delete', async () => {
    await mount();
    await reachConfirm();
    await act(async () => {
      const p = api.confirmMatch();
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('awaiting');

    // The countdown is anchored at the JOINED snapshot's arrival; the later
    // VERIFYING snapshot does not re-anchor it.
    await act(async () => {
      listeners.session({ status: 'JOINED', joinedAt: ts(T0) });
      await flush();
    });
    await act(async () => {
      listeners.session({ status: 'VERIFYING', verifyingAt: ts(T0) });
      await flush();
    });
    await act(async () => {
      jest.advanceTimersByTime(STATE_TTL + PAIRING_EXPIRY_SLACK_MS + 1);
      await flush();
    });
    expect(api.status).toBe('expired');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.expired');
    // Active kill: the session is cancelled and our own handshake docs deleted.
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(
      RID,
      joinedSessionId(),
    );
    expect(mockDb.deletePairingHandshake).toHaveBeenCalledWith(
      RID,
      joinedSessionId(),
    );
  });

  test('confirmMatch no-ops from a terminal state (symmetry guard)', async () => {
    await mount();
    await submitName();
    const sessionId = joinedSessionId();

    await act(async () => {
      listeners.session({ status: 'CANCELLED' });
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

  test("Don't Match tears down instantly; next submitName drains the pending cancel", async () => {
    await mount();
    await reachConfirm();
    const sessionId = joinedSessionId();

    let resolveCancel;
    mockDb.cancelPairingSession.mockReturnValueOnce(
      new Promise(res => {
        resolveCancel = res;
      }),
    );

    // Sync teardown lands before the Firebase write resolves — the screen pops
    // back immediately; the cancel continues in the background.
    await act(async () => {
      api.declineMatch();
      await flush();
    });
    expect(api.status).toBe('idle');
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(RID, sessionId);

    // Re-pair while the decline write is still in flight: submitName drains it
    // before joining the next session, so the new pairing never overlaps the
    // previous session's cleanup.
    await act(async () => {
      const p = api.submitName(PARENT_NAME);
      await flush();
      expect(mockDb.joinPairingSession).toHaveBeenCalledTimes(1);
      resolveCancel(true);
      await p;
      await flush();
    });
    expect(mockDb.joinPairingSession).toHaveBeenCalledTimes(2);
    expect(api.status).toBe('joining');
  });
});
