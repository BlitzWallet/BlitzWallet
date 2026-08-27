/* eslint-env jest */
// ---------------------------------------------------------------------------
// childClaimContext — child-side claim state machine (JIT sessions).
//
// Drives the real provider with mocked `../db` helpers and injects Firestore
// events through captured callbacks. The child discovers + atomically claims the
// session through the rate-limited proxy endpoint (claimPairingSession — the
// client can no longer read the session by code or blind-claim it), then watches
// the SESSION doc for cancellation/deletion.
//   - happy path: submitPairing → parentReveal → confirm → confirmMatch →
//     childConfirm → grant → done (decrypt-success is the terminal; the
//     session's COMPLETED marker is never observed, D5).
//   - commit mismatch → tamper; session CANCELLED → canceled; session deleted /
//     deadline passed → derived expired.
//   - wrong code → the wrongCode copy; join denial → the single "start a new
//     pairing" copy (D4), never an "already claimed" diagnosis.
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const CHILD_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PARENT_NAME = 'ParentName';
const RID = 'parentname';
const CODE = '482916';
const CODE_B = '731204'; // a second session code for re-pair regression tests
const STATE_TTL = 180000; // per-state server deadline
const PAIRING_EXPIRY_SLACK_MS = 10 * 1000; // passive-fallback slack (source: childClaimContext.js)
const T0 = 1_700_000_000_000;

const mockSetAccountMnemonic = jest.fn();
const mockDb = {
  claimPairingSession: jest.fn(),
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
  claimPairingSession: (...a) => mockDb.claimPairingSession(...a),
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

async function submitPairing() {
  await act(async () => {
    const p = api.submitPairing({ name: PARENT_NAME, code: CODE });
    await flush();
    await p;
    await flush();
  });
  expect(api.status).toBe('joining');
}

async function reachConfirm() {
  await submitPairing();
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

// Keyed listener lookup: a subscription stored under `party:sessionId` (or
// `session:sessionId`) stays addressable even after a newer session took over
// the refs — the regression tests fire STALE listeners through these keys.
function listenerFor(party, sessionId = CODE) {
  return listeners[`${party}:${sessionId}`];
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
  jest.useFakeTimers();
  jest.setSystemTime(T0);
  jest.clearAllMocks();
  listeners = {};
  parentEph = makeChildEphKey();
  mockDb.claimPairingSession.mockResolvedValue({
    ok: true,
    commit: makeKeyCommitment(parentEph.pub),
  });
  mockDb.setPairingDoc.mockImplementation(async () => true);
  mockDb.subscribePairingDoc.mockImplementation(
    (rid, sessionId, party, onData) => {
      // Key every subscription by party:sessionId so stale/leaked listeners
      // from dead sessions stay addressable in the regression tests (harness
      // tweak, review §9). The unkeyed alias tracks the LATEST subscription so
      // the original tests keep firing the current session's listener.
      const key = `${party}:${sessionId}`;
      listeners[key] = onData;
      listeners[party] = onData;
      return jest.fn(() => {
        delete listeners[key];
        if (listeners[party] === onData) delete listeners[party];
      });
    },
  );
  mockDb.subscribePairingSession.mockImplementation(
    (rid, sessionId, onData) => {
      const key = `session:${sessionId}`;
      listeners[key] = onData;
      listeners.session = onData;
      return jest.fn(() => {
        delete listeners[key];
        if (listeners.session === onData) delete listeners.session;
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
  test('submitPairing → parentReveal → confirm → confirmMatch → grant → done', async () => {
    await mount();
    await reachConfirm();
    const childSessionPub = sessionEphPub();
    const sessionId = joinedSessionId();

    // The session is discovered + claimed in one admin-mediated call by the
    // secret code — no client read, no client join.
    expect(mockDb.claimPairingSession).toHaveBeenCalledWith(RID, CODE);
    expect(sessionId).toBe(CODE);
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
    await submitPairing();

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
    mockDb.claimPairingSession.mockResolvedValue({
      ok: true,
      commit: makeKeyCommitment('00'.repeat(32)),
    });
    await mount();
    await submitPairing();

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

describe('childClaimContext — claim outcomes (D4)', () => {
  test('a generic claim failure → one "start a new pairing" copy, never a diagnosis', async () => {
    mockDb.claimPairingSession.mockResolvedValueOnce({
      ok: false,
      error: 'request_failed',
    });
    await mount();

    await act(async () => {
      const p = api.submitPairing({ name: PARENT_NAME, code: CODE });
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('idle');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.askToRestart');
    // No hello attempted on a denied claim.
    expect(mockDb.setPairingDoc).not.toHaveBeenCalled();
  });

  test('an already-claimed session → slotTaken (server "taken")', async () => {
    mockDb.claimPairingSession.mockResolvedValueOnce({
      ok: false,
      error: 'taken',
    });
    await mount();

    await act(async () => {
      const p = api.submitPairing({ name: PARENT_NAME, code: CODE });
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('idle');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.slotTaken');
    expect(mockDb.setPairingDoc).not.toHaveBeenCalled();
  });

  test('no session for that code → wrongCode copy (server "not_found")', async () => {
    mockDb.claimPairingSession.mockResolvedValueOnce({
      ok: false,
      error: 'not_found',
    });
    await mount();

    await act(async () => {
      const p = api.submitPairing({ name: PARENT_NAME, code: CODE });
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('idle');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.wrongCode');
  });

  test('rate limited → the rateLimited copy (server "rate_limited")', async () => {
    mockDb.claimPairingSession.mockResolvedValueOnce({
      ok: false,
      error: 'rate_limited',
    });
    await mount();

    await act(async () => {
      const p = api.submitPairing({ name: PARENT_NAME, code: CODE });
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('idle');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.rateLimited');
  });

  test('malformed code input → wrongCode copy, no claim attempted', async () => {
    await mount();

    await act(async () => {
      const p = api.submitPairing({ name: PARENT_NAME, code: '12' });
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('idle');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.wrongCode');
    expect(mockDb.claimPairingSession).not.toHaveBeenCalled();
  });
});

describe('childClaimContext — QR path (scannedParentPub)', () => {
  async function submitScannedPairing(scannedParentPub = parentEph.pub) {
    await act(async () => {
      const p = api.submitPairing({
        name: PARENT_NAME,
        code: CODE,
        scannedParentPub,
      });
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('joining');
  }

  test('matching reveal auto-confirms → grant → done, never entering confirm', async () => {
    await mount();
    await submitScannedPairing();

    await act(async () => {
      listeners.parentReveal({ parentEphPub: parentEph.pub });
      await flush();
    });
    // The key-equality check replaces the SAS screen: no confirm status, no
    // SAS pattern, straight to the grant wait with childConfirm written.
    expect(api.status).toBe('awaiting');
    expect(api.sas).toBe('');
    expect(mockDb.setPairingDoc).toHaveBeenCalledWith(
      RID,
      CODE,
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
  });

  test('reveal mismatching the scanned pubkey → tamper (key-equality check)', async () => {
    // The commitment is made over the attacker's key (simulating a QR/commit
    // pair that disagree — e.g. a stale QR from another pairing attempt), so
    // the commit check passes and the reveal reaches the equality assertion.
    const attacker = makeChildEphKey();
    mockDb.claimPairingSession.mockResolvedValue({
      ok: true,
      commit: makeKeyCommitment(attacker.pub),
    });
    await mount();
    await submitScannedPairing();

    await act(async () => {
      listeners.parentReveal({ parentEphPub: attacker.pub });
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.tamper');
    // No auto-confirm, no grant wait.
    expect(mockDb.setPairingDoc).not.toHaveBeenCalledWith(
      RID,
      CODE,
      'childConfirm',
      expect.anything(),
    );
    expect(mockSetAccountMnemonic).not.toHaveBeenCalled();
  });

  test('code path (no scannedParentPub) still lands on confirm with a SAS', async () => {
    await mount();
    await submitPairing();

    await act(async () => {
      listeners.parentReveal({ parentEphPub: parentEph.pub });
      await flush();
    });
    expect(api.status).toBe('confirm');
    expect(api.sas).toBeTruthy();
    expect(mockDb.setPairingDoc).not.toHaveBeenCalledWith(
      RID,
      CODE,
      'childConfirm',
      expect.anything(),
    );
  });
});

describe('childClaimContext — SAS-gating invariants', () => {
  test('no grant listener exists before the human confirm — an early grant can never be imported', async () => {
    // The seed-before-SAS invariant: the grant subscription is only created
    // inside confirmMatch, so a grant doc that lands while the SAS screen is
    // still up has no consumer. The child never observes ciphertext before the
    // human compares the pattern.
    await mount();
    await reachConfirm();
    expect(api.status).toBe('confirm');
    expect(listeners.grant).toBeUndefined();
    expect(mockDb.subscribePairingDoc).not.toHaveBeenCalledWith(
      RID,
      expect.anything(),
      'grant',
      expect.any(Function),
    );
    expect(mockSetAccountMnemonic).not.toHaveBeenCalled();
  });

  test('a grant doc replayed after declineMatch is never imported (session torn down)', async () => {
    await mount();
    await reachConfirm();
    await act(async () => {
      api.declineMatch();
      await flush();
    });
    expect(api.status).toBe('idle');
    // A late/replayed fire of the (now-unsubscribed) grant listener must not
    // import — importSeed guards on a live sessionRef.
    const enc = grantPayload();
    await act(async () => {
      listeners.grant?.({ ciphertext: enc.ct, iv: enc.iv, tag: enc.tag });
      await flush();
    });
    expect(mockSetAccountMnemonic).not.toHaveBeenCalled();
    expect(api.status).toBe('idle');
  });

  test('double-submit: the second same-frame submit is dropped by the guard', async () => {
    // The joining guard reads statusRef (set synchronously before the claim),
    // so two same-frame submits cannot both call the proxy: only the first
    // proceeds, the second is a no-op. One childHello write for exactly one
    // (rid, code) session.
    mockDb.claimPairingSession.mockResolvedValue({
      ok: true,
      commit: makeKeyCommitment(parentEph.pub),
    });
    await mount();

    await act(async () => {
      const a = api.submitPairing({ name: PARENT_NAME, code: CODE });
      const b = api.submitPairing({ name: PARENT_NAME, code: CODE });
      await flush();
      await Promise.all([a, b]);
      await flush();
    });
    expect(mockDb.claimPairingSession).toHaveBeenCalledTimes(1);
    // Exactly one childHello write, for exactly one (rid, code) session.
    expect(childHelloCalls()).toHaveLength(1);
  });
});

describe('childClaimContext — terminal states', () => {
  test('parent cancel (session CANCELLED) → error', async () => {
    await mount();
    await submitPairing();

    await act(async () => {
      listeners.session({ status: 'CANCELLED' });
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe(
      'settings.childAccounts.claim.canceledByParent',
    );
  });

  test('resetSession clears the terminal state synchronously — before server cleanup drains', async () => {
    await mount();
    await submitPairing();

    await act(async () => {
      listeners.session({ status: 'CANCELLED' });
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe(
      'settings.childAccounts.claim.canceledByParent',
    );

    // The handshake deletes hang (offline Firestore writes can stay queued
    // indefinitely): leaving the failed pairing (tab switch / back) must drop
    // the error at once instead of rendering the stale copy until the writes
    // settle.
    let resolveDelete;
    mockDb.deletePairingHandshake.mockReturnValueOnce(
      new Promise(res => {
        resolveDelete = res;
      }),
    );
    let pendingReset;
    await act(async () => {
      pendingReset = api.resetSession();
    });
    // resetSession is parked on the hung delete, yet the local reset has
    // already landed — the terminal copy/status cannot outlive the tab switch.
    expect(api.status).toBe('idle');
    expect(api.errorMessage).toBe('');
    expect(api.sas).toBe('');
    expect(mockDb.deletePairingHandshake).toHaveBeenCalledWith(RID, CODE);

    await act(async () => {
      resolveDelete();
      await pendingReset;
    });
    expect(api.status).toBe('idle');
  });

  test('session doc deleted (TTL GC) → derived expired', async () => {
    await mount();
    await submitPairing();

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
    await submitPairing();

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
    await submitPairing();
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

  test("Don't Match tears down instantly; next submitPairing drains the pending cancel", async () => {
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

    // Re-pair while the decline write is still in flight: submitPairing drains
    // it before joining the next session, so the new pairing never overlaps the
    // previous session's cleanup.
    await act(async () => {
      const p = api.submitPairing({ name: PARENT_NAME, code: CODE });
      await flush();
      expect(mockDb.claimPairingSession).toHaveBeenCalledTimes(1);
      resolveCancel(true);
      await p;
      await flush();
    });
    expect(mockDb.claimPairingSession).toHaveBeenCalledTimes(2);
    expect(api.status).toBe('joining');
  });
});

describe('childClaimContext — teardown + generation counter (F-3/F-4/F-8/F-9)', () => {
  // F-3: a re-submit from any state must tear down the previous session's
  // listeners (and key material) instead of overwriting the refs and leaking
  // the old subscriptions onto the new session.

  test('T-F3a: re-submitting while a session is live tears down the old session listeners', async () => {
    await mount();
    await submitPairing(); // session A (CODE)
    await act(async () => {
      listeners[`parentReveal:${CODE}`]({ parentEphPub: parentEph.pub });
      await flush();
    });
    expect(api.status).toBe('confirm');
    expect(listeners[`parentReveal:${CODE}`]).toBeDefined();

    // Re-submit for a new code directly (no reset in between — the context's
    // entry teardown must detach A's listeners itself).
    await act(async () => {
      const p = api.submitPairing({ name: PARENT_NAME, code: CODE_B });
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('joining');
    expect(listeners[`parentReveal:${CODE}`]).toBeUndefined();
    expect(listeners[`session:${CODE}`]).toBeUndefined();
    expect(listeners[`parentReveal:${CODE_B}`]).toBeDefined();
    expect(listeners[`session:${CODE_B}`]).toBeDefined();
  });

  // F-4: a submitPairing that survives a reset must detect it (generation
  // counter) and release the claimed server session instead of acting on the
  // new session's globals.

  test('T-F3b: a zombie submitPairing resolving after a reset bails without touching the new session', async () => {
    await mount();

    // A's claim stays in flight.
    let resolveClaimA;
    mockDb.claimPairingSession.mockReturnValueOnce(
      new Promise(res => {
        resolveClaimA = res;
      }),
    );
    await act(async () => {
      api.submitPairing({ name: PARENT_NAME, code: CODE });
      await flush();
    });

    // The user resets (back button) and starts B with a different code.
    await act(async () => {
      await api.resetSession();
      await flush();
    });
    expect(api.status).toBe('idle');
    await act(async () => {
      const p = api.submitPairing({ name: PARENT_NAME, code: CODE_B });
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('joining');
    expect(listeners[`session:${CODE_B}`]).toBeDefined();

    // A's claim resolves late: the gen guard releases A's claimed session and
    // bails — none of A's continuation lands on B.
    await act(async () => {
      resolveClaimA({ ok: true, commit: makeKeyCommitment(parentEph.pub) });
      await flush();
    });
    expect(api.status).toBe('joining');
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(RID, CODE);
    expect(childHelloCalls()).toHaveLength(1);
    expect(childHelloCalls()[0][1]).toBe(CODE_B);
    expect(listeners[`session:${CODE}`]).toBeUndefined();
    expect(listeners[`session:${CODE_B}`]).toBeDefined();
  });

  test('T-F4: a zombie submitPairing resolving after its hello write releases the claimed session', async () => {
    await mount();

    // A claims immediately; its hello write stays in flight.
    let resolveHelloA;
    mockDb.setPairingDoc.mockImplementationOnce((r, s, party) =>
      party === 'childHello'
        ? new Promise(res => {
            resolveHelloA = res;
          })
        : Promise.resolve(true),
    );
    await act(async () => {
      api.submitPairing({ name: PARENT_NAME, code: CODE });
      await flush();
    });
    expect(mockDb.claimPairingSession).toHaveBeenCalledWith(RID, CODE);

    // Reset mid-hello, then B starts.
    await act(async () => {
      await api.resetSession();
      await flush();
    });
    await act(async () => {
      const p = api.submitPairing({ name: PARENT_NAME, code: CODE_B });
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('joining');
    expect(listeners[`session:${CODE_B}`]).toBeDefined();

    // A's hello resolves late → release A's claimed session and bail.
    await act(async () => {
      resolveHelloA(true);
      await flush();
    });
    expect(api.status).toBe('joining');
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(RID, CODE);
    expect(listeners[`session:${CODE}`]).toBeUndefined();
    expect(listeners[`parentReveal:${CODE}`]).toBeUndefined();
    expect(listeners[`session:${CODE_B}`]).toBeDefined();
    expect(listeners[`parentReveal:${CODE_B}`]).toBeDefined();
  });

  // F-8: every terminal path routes through endSession so listeners are torn
  // down (and the session cancelled) on every terminal state — a stale listener
  // can never fire on the next session's globals.

  test('T-F8: a TTL-deleted session doc ends through endSession (listeners torn down)', async () => {
    await mount();
    await submitPairing();
    await act(async () => {
      listeners[`session:${CODE}`](null);
      await flush();
    });
    expect(api.status).toBe('expired');
    expect(listeners[`session:${CODE}`]).toBeUndefined();
    expect(listeners[`parentReveal:${CODE}`]).toBeUndefined();
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(RID, CODE);
    expect(mockDb.deletePairingHandshake).toHaveBeenCalledWith(RID, CODE);
  });

  test('T-F8: parent CANCELLED ends through endSession (listeners torn down)', async () => {
    await mount();
    await submitPairing();
    await act(async () => {
      listeners[`session:${CODE}`]({ status: 'CANCELLED' });
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe(
      'settings.childAccounts.claim.canceledByParent',
    );
    expect(listeners[`session:${CODE}`]).toBeUndefined();
    expect(listeners[`parentReveal:${CODE}`]).toBeUndefined();
  });

  test('T-F8: a commit-mismatched reveal ends through endSession (listeners torn down)', async () => {
    await mount();
    await submitPairing();
    await act(async () => {
      listeners[`parentReveal:${CODE}`]({
        parentEphPub: makeChildEphKey().pub,
      });
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.tamper');
    expect(listeners[`parentReveal:${CODE}`]).toBeUndefined();
    expect(listeners[`session:${CODE}`]).toBeUndefined();
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(RID, CODE);
    expect(mockDb.deletePairingHandshake).toHaveBeenCalledWith(RID, CODE);
  });

  test('T-F8: a reveal mismatching the scanned QR pubkey ends through endSession', async () => {
    const attacker = makeChildEphKey();
    mockDb.claimPairingSession.mockResolvedValue({
      ok: true,
      commit: makeKeyCommitment(attacker.pub),
    });
    await mount();
    await act(async () => {
      const p = api.submitPairing({
        name: PARENT_NAME,
        code: CODE,
        scannedParentPub: parentEph.pub,
      });
      await flush();
      await p;
      await flush();
    });
    await act(async () => {
      listeners[`parentReveal:${CODE}`]({ parentEphPub: attacker.pub });
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.tamper');
    expect(listeners[`parentReveal:${CODE}`]).toBeUndefined();
    expect(listeners[`session:${CODE}`]).toBeUndefined();
  });

  test('T-F8: a rules-denied childConfirm ends through endSession (session torn down)', async () => {
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
    expect(listeners[`parentReveal:${CODE}`]).toBeUndefined();
    expect(listeners[`session:${CODE}`]).toBeUndefined();
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(RID, CODE);
  });

  test('T-F8: a tampered grant ends through endSession (session torn down)', async () => {
    await mount();
    await reachConfirm();
    await act(async () => {
      const p = api.confirmMatch();
      await flush();
      await p;
      await flush();
    });
    await act(async () => {
      listeners[`grant:${CODE}`]({ ciphertext: 'zz', iv: 'zz', tag: 'zz' });
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe('settings.childAccounts.claim.tamper');
    expect(listeners[`grant:${CODE}`]).toBeUndefined();
    expect(listeners[`parentReveal:${CODE}`]).toBeUndefined();
    expect(listeners[`session:${CODE}`]).toBeUndefined();
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(RID, CODE);
  });

  // F-9: statusRef is set synchronously so a same-frame double entry (double
  // tap on Match) is a no-op instead of a re-entry.

  test('T-F9: double-tapping Match in the same frame writes childConfirm once and subscribes one grant listener', async () => {
    await mount();
    await reachConfirm();
    await act(async () => {
      const a = api.confirmMatch();
      const b = api.confirmMatch();
      await flush();
      await Promise.all([a, b]);
      await flush();
    });
    expect(api.status).toBe('awaiting');
    expect(
      mockDb.setPairingDoc.mock.calls.filter(
        ([, , p]) => p === 'childConfirm',
      ),
    ).toHaveLength(1);
    expect(
      mockDb.subscribePairingDoc.mock.calls.filter(([, , p]) => p === 'grant'),
    ).toHaveLength(1);
  });
});
