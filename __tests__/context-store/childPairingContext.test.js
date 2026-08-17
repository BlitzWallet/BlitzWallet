/* eslint-env jest */
// ---------------------------------------------------------------------------
// childPairingContext — parent-side pairing state machine (JIT sessions).
//
// Drives the real provider with mocked `../db` helpers and injects Firestore
// events through captured callbacks. The rendezvous is the parent's own
// username; startPairing opens a fresh session doc (createPairingSession) under
// a 6-digit code and the SESSION doc — not a pointer — drives the lifecycle:
//   - happy path: startPairing → session JOINED → childHello → VERIFYING
//     advance → confirm → Match → childConfirm → grant → best-effort COMPLETED
//     advance → done.
//   - re-pair back-to-back: sessions never collide, so a second startPairing
//     opens a fresh session immediately (no SESSION_IN_PROGRESS machinery).
//   - terminal states: child cancel (session CANCELLED), derived expiry
//     (rules-denied transition, D2), parent decline, and the passive fallback —
//     driven by the SAME shared tick as the countdown clock, so it fires
//     exactly when the clock hits 0 (no slack).
//   - D5: a denied COMPLETED advance after the grant still lands on done.
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const CHILD_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const CHILD = { childIndex: 0, name: 'Kid', spendingLimit: 1000 };
const T0 = 1_700_000_000_000;
const PARENT_NAME = 'ParentName';
const RID = 'parentname'; // normalizePairingName(PARENT_NAME)
const STATE_TTL = 180000; // per-state server deadline

// Controllable stand-in for the shared app tick (useAccountsExpiryTimeTick).
// The context's expiry fallback and the pairingExpiryClock countdown consume
// the same hook; here we drive it directly to assert the exact-zero firing.
let mockTick = 0;
const mockTickListeners = new Set();
jest.mock('../../app/functions/accounts/expiryTimeTick', () => ({
  useAccountsExpiryTimeTick: () => {
    const { useSyncExternalStore } = require('react');
    return useSyncExternalStore(
      cb => {
        mockTickListeners.add(cb);
        return () => mockTickListeners.delete(cb);
      },
      () => mockTick,
    );
  },
}));

// The serverTimestamp objects the session snapshot carries (the provider only
// reads .toMillis()).
const ts = ms => ({ toMillis: () => ms });

let nextSessionId = 1;
const mockDb = {
  createPairingSession: jest.fn(async () =>
    String(nextSessionId++).padStart(6, '0'),
  ),
  advanceSessionStatus: jest.fn(async () => true),
  cancelPairingSession: jest.fn(async () => true),
  deletePairingHandshake: jest.fn(async () => {}),
  setPairingDoc: jest.fn(async () => true),
  subscribePairingDoc: jest.fn(),
  subscribePairingSession: jest.fn(),
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
  createPairingSession: (...a) => mockDb.createPairingSession(...a),
  advanceSessionStatus: (...a) => mockDb.advanceSessionStatus(...a),
  cancelPairingSession: (...a) => mockDb.cancelPairingSession(...a),
  deletePairingHandshake: (...a) => mockDb.deletePairingHandshake(...a),
  setPairingDoc: (...a) => mockDb.setPairingDoc(...a),
  subscribePairingDoc: (...a) => mockDb.subscribePairingDoc(...a),
  subscribePairingSession: (...a) => mockDb.subscribePairingSession(...a),
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
  parsePairingQr,
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

// Advance the shared tick to ms and re-render, like the real 1s interval does.
async function setTick(ms) {
  mockTick = ms;
  await act(async () => {
    mockTickListeners.forEach(l => l());
    await flush();
  });
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

// The child claims the session (JOINED snapshot → rendezvous dropped), then
// writes childHello; the parent advances to VERIFYING and reveals. The initial
// WAITING snapshot anchors the pairing countdown at session creation — state
// transitions (JOINED / VERIFYING) deliberately do NOT re-anchor it, so the
// maximum pairing time is 3m total from creation, never 3m per state.
async function reachConfirm() {
  await runStartPairing();
  await act(async () => {
    listeners.session({ status: 'WAITING', createdAt: ts(T0) });
    await flush();
  });
  expect(api.pairingExpiryClock).toEqual({ anchor: T0, startedAt: T0 });
  await act(async () => {
    listeners.session({ status: 'JOINED', joinedAt: ts(T0 + 60000) });
    await flush();
  });
  // A later state with a later server timestamp must not reset the clock.
  expect(api.pairingExpiryClock).toEqual({ anchor: T0, startedAt: T0 });
  await act(async () => {
    listeners.childHello({ childEphPub: childEph.pub });
    await flush();
  });
  expect(api.status).toBe('confirm');
}

// The sessionId the provider threaded into its live wire calls (the async
// createPairingSession return, resolved). Read it off the latest session
// subscription.
function lastSessionId() {
  const calls = mockDb.subscribePairingSession.mock.calls.filter(
    c => c[0] === RID,
  );
  return calls[calls.length - 1][1];
}

// Keyed listener lookup: a subscription stored under `party:sessionId` (or
// `session:sessionId`) stays addressable even after a newer session took over
// the refs — the regression tests fire STALE listeners through these keys.
function listenerFor(party, sessionId = lastSessionId()) {
  return listeners[`${party}:${sessionId}`];
}

// setPairingDoc(rid, sessionId, party, data) → data is index [3].
function findDocCall(party) {
  return mockDb.setPairingDoc.mock.calls.find(([, , p]) => p === party);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(T0);
  mockTick = T0;
  jest.clearAllMocks();
  nextSessionId = 1;
  listeners = {};
  childEph = makeChildEphKey();
  mockDb.subscribePairingDoc.mockImplementation(
    (rid, sessionId, party, onData) => {
      // Key every subscription by party:sessionId so stale/leaked listeners from
      // dead sessions stay addressable in the regression tests (harness tweak,
      // review §9). The unkeyed alias tracks the LATEST subscription so the
      // original tests keep firing the current session's listener.
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

describe('childPairingContext — happy path', () => {
  test('startPairing → JOINED → childHello → confirm → Match → childConfirm → done', async () => {
    await mount();
    await reachConfirm();

    // A fresh JIT session opened under the parent's own username, with a fresh
    // 6-digit pairing code (no SESSION_IN_PROGRESS machinery). The code is
    // exposed for the link screen to display.
    expect(mockDb.createPairingSession).toHaveBeenCalledWith(
      RID,
      'parent-pub',
      expect.objectContaining({ commit: expect.any(String) }),
    );
    expect(api.pairingCode).toMatch(/^[0-9]{6}$/);

    // The parent advances the session to VERIFYING before revealing its eph
    // pubkey (the JOINED snapshot no longer drops a rendezvous pointer).
    const sessionId = lastSessionId();
    expect(mockDb.advanceSessionStatus).toHaveBeenCalledWith(
      RID,
      sessionId,
      'VERIFYING',
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
    // Grant delivered → best-effort COMPLETED marker, handshake NOT deleted
    // (child still needs to read the grant doc).
    expect(mockDb.advanceSessionStatus).toHaveBeenCalledWith(
      RID,
      sessionId,
      'COMPLETED',
    );
    expect(mockDb.deletePairingHandshake).not.toHaveBeenCalled();
  });

  test('unmount after done never re-cancels the COMPLETED session', async () => {
    await mount();
    await reachConfirm();
    await act(async () => {
      api.confirmMatch();
      await flush();
    });
    await act(async () => {
      listeners.childConfirm();
      await flush();
    });
    expect(api.status).toBe('done');

    // Leaving the flow: the session is granted (COMPLETED, terminal), so the
    // unmount cleanup must NOT cancel it — a terminal→CANCELLED write the rules
    // deny (permission-denied on every successful pairing).
    await act(async () => {
      renderer.unmount();
    });
    renderer = null;
    expect(mockDb.cancelPairingSession).not.toHaveBeenCalled();
    expect(mockDb.deletePairingHandshake).not.toHaveBeenCalled();
  });

  test('D5: a denied COMPLETED advance still lands on done (grant is the terminal)', async () => {
    mockDb.advanceSessionStatus.mockImplementation(async (r, s, next) =>
      next === 'COMPLETED' ? false : true,
    );
    await mount();
    await reachConfirm();

    await act(async () => {
      api.confirmMatch();
      await flush();
    });
    await act(async () => {
      listeners.childConfirm();
      await flush();
    });
    expect(api.status).toBe('done');
    // The grant was delivered; the failed COMPLETED marker is swallowed.
    expect(findDocCall('grant')).toBeTruthy();
    expect(mockDb.advanceSessionStatus).toHaveBeenCalledWith(
      RID,
      lastSessionId(),
      'COMPLETED',
    );
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

    // Immediately re-pair a second child (same parent username). The done
    // screen resets the session; because sessions never collide, the second
    // createPairingSession is not blocked and opens a fresh session.
    await act(async () => {
      await api.resetSession();
      await flush();
    });
    childEph = makeChildEphKey();
    await reachConfirm();
    const secondSession = lastSessionId();

    expect(mockDb.createPairingSession).toHaveBeenCalledTimes(2);
    expect(secondSession).not.toBe(firstSession);
    expect(api.status).toBe('confirm');
  });
});

describe('childPairingContext — grant-gating invariants', () => {
  test('no childConfirm listener and no grant write before the parent presses Match', async () => {
    // The seed-before-SAS invariant, parent side: the childConfirm subscription
    // (the only path that writes the grant) is created inside confirmMatch, so
    // a childConfirm doc that lands while the SAS screen is up is never seen —
    // the encrypted seed can never leave the parent before the human compares
    // the pattern.
    await mount();
    await reachConfirm();
    expect(api.status).toBe('confirm');
    expect(listeners.childConfirm).toBeUndefined();
    expect(mockDb.subscribePairingDoc).not.toHaveBeenCalledWith(
      RID,
      expect.anything(),
      'childConfirm',
      expect.any(Function),
    );
    expect(findDocCall('grant')).toBeUndefined();
  });

  test('the child seed stays out of reach after a SAS decline (wiped, no grant, session cancelled)', async () => {
    await mount();
    await reachConfirm();
    const sessionId = lastSessionId();
    await act(async () => {
      await api.declineMatch();
      await flush();
    });
    // Decline cancels the session and tears the provider down; no grant was
    // ever written and no childConfirm listener exists for a replayed confirm.
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(RID, sessionId);
    expect(findDocCall('grant')).toBeUndefined();
    expect(listeners.childConfirm).toBeUndefined();
  });
});

describe('childPairingContext — QR mode', () => {
  async function startQrPairing() {
    await act(async () => {
      const p = api.startPairing(CHILD, 'qr');
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('waiting');
  }

  test('qrValue carries name + code + parent pubkey once the session is live', async () => {
    await mount();
    await startQrPairing();

    expect(api.qrValue).toBeTruthy();
    const payload = parsePairingQr(api.qrValue);
    expect(payload).toEqual({
      name: RID,
      code: lastSessionId(),
      parentEphPub: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    // The pubkey in the QR is the same one revealed on the wire — this is
    // what lets the child's automatic key-equality check replace the SAS.
    await act(async () => {
      listeners.childHello({ childEphPub: childEph.pub });
      await flush();
    });
    expect(findDocCall('parentReveal')[3].parentEphPub).toBe(
      payload.parentEphPub,
    );
  });

  test("mode='qr': childHello reveals but waits for the parent's Accept tap before granting", async () => {
    await mount();
    await startQrPairing();

    await act(async () => {
      listeners.childHello({ childEphPub: childEph.pub });
      await flush();
    });
    // No SAS screen on the QR path (the child scans our pubkey out-of-band),
    // but NO grant either: the parent reveals and keeps waiting. The seed can
    // never leave before the parent consciously accepts.
    expect(api.status).toBe('waiting');
    expect(api.sas).toBe('');
    expect(findDocCall('grant')).toBeUndefined();

    // The child auto-confirms (its reveal matched the scanned QR) → the parent
    // surfaces the Accept screen. Still no grant.
    await act(async () => {
      listeners.childConfirm();
      await flush();
    });
    expect(api.status).toBe('accept');
    expect(findDocCall('grant')).toBeUndefined();

    // The parent taps Accept → grant delivered → done.
    await act(async () => {
      api.acceptPairing();
      await flush();
    });
    expect(api.status).toBe('done');

    const grant = findDocCall('grant');
    expect(grant).toBeTruthy();
    const parentEphPub = findDocCall('parentReveal')[3].parentEphPub;
    const childSharedX = deriveSharedX(childEph.priv, parentEphPub);
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
    // Same terminal semantics as the code path: grant delivered, handshake
    // docs left for the child.
    expect(mockDb.deletePairingHandshake).not.toHaveBeenCalled();
  });

  test('backstop (CRITICAL): a QR childConfirm never grants without the Accept tap', async () => {
    // A scripted claimer that photographed the QR and raced to childConfirm in
    // <1s must still get NOTHING: the grant doc is written only by the parent's
    // Accept tap, which makes seed theft timed and visible instead of silent.
    await mount();
    await startQrPairing();
    await act(async () => {
      listeners.childHello({ childEphPub: childEph.pub });
      await flush();
    });
    const sessionId = lastSessionId();
    await act(async () => {
      listeners.childConfirm();
      await flush();
    });
    expect(api.status).toBe('accept');
    expect(findDocCall('grant')).toBeUndefined();

    // The parent declines the suspicious prompt → session cancelled, no grant.
    await act(async () => {
      await api.declineMatch();
      await flush();
    });
    expect(findDocCall('grant')).toBeUndefined();
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(RID, sessionId);
  });

  test("mode='code' is unchanged: childHello still lands on confirm with a SAS", async () => {
    await mount();
    await runStartPairing();

    await act(async () => {
      listeners.childHello({ childEphPub: childEph.pub });
      await flush();
    });
    expect(api.status).toBe('confirm');
    expect(api.sas).toBeTruthy();
    expect(api.qrValue).toBe('');
    expect(findDocCall('grant')).toBeUndefined();
  });
});

describe('childPairingContext — terminal states', () => {
  test('child cancels while modal open → error, stale Match no-ops', async () => {
    await mount();
    await reachConfirm();
    const sessionId = lastSessionId();

    await act(async () => {
      listeners.session({ status: 'CANCELLED' });
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe(
      'settings.childAccounts.pairing.declinedByChild',
    );
    // Session dead: listeners torn down. The child already moved the session to
    // CANCELLED (terminal), so the parent must NOT re-cancel it — that would be a
    // terminal→CANCELLED write the rules deny (permission-denied). It also leaves
    // its own handshake docs for TTL rather than issuing pointless deletes.
    expect(listeners.session).toBeUndefined();
    expect(listeners.childHello).toBeUndefined();
    expect(mockDb.cancelPairingSession).not.toHaveBeenCalled();
    expect(mockDb.deletePairingHandshake).not.toHaveBeenCalled();

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

  test('rules-denied advance surfaces derived expired (D2), not a client timer', async () => {
    mockDb.advanceSessionStatus.mockResolvedValueOnce(false);
    await mount();
    await runStartPairing();

    await act(async () => {
      listeners.session({ status: 'JOINED', joinedAt: ts(T0) });
      await flush();
    });
    await act(async () => {
      listeners.childHello({ childEphPub: childEph.pub });
      await flush();
    });
    expect(api.status).toBe('expired');
    expect(api.errorMessage).toBe('settings.childAccounts.pairing.expired');
    // Dead session torn down.
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(
      RID,
      lastSessionId(),
    );
  });

  test('malformed childHello pubkey → tamper error, dead session cancelled (no crash)', async () => {
    await mount();
    await runStartPairing();

    // A peer-controlled Firestore value that is not a valid 32-byte hex pubkey
    // must not reach the curve math or crash the snapshot listener.
    await act(async () => {
      listeners.childHello({ childEphPub: 'zz-not-hex' });
      await flush();
    });
    expect(api.status).toBe('error');
    expect(api.errorMessage).toBe('settings.childAccounts.pairing.tamper');
    // The dead session is actively cancelled and our handshake docs deleted.
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(
      RID,
      lastSessionId(),
    );
    expect(mockDb.deletePairingHandshake).toHaveBeenCalledWith(
      RID,
      lastSessionId(),
    );
  });

  test('passive expiry fallback fires exactly when the countdown hits 0', async () => {
    await mount();
    await runStartPairing();

    // Anchor the countdown to the server-written createdAt (startedAt = T0).
    await act(async () => {
      listeners.session({ status: 'WAITING', createdAt: ts(T0) });
      await flush();
    });
    expect(api.status).toBe('waiting');

    // The shared tick just before the 3m server deadline: still alive, the
    // countdown still reads 0:01.
    await setTick(T0 + STATE_TTL - 1);
    expect(api.status).toBe('waiting');

    // The next tick crosses the deadline — the countdown reads 0:00 and the
    // session dies in the same render. No slack: the active kill (cancel +
    // delete our handshake docs) fires exactly at zero, not seconds later.
    await setTick(T0 + STATE_TTL);
    expect(api.status).toBe('expired');
    expect(api.errorMessage).toBe('settings.childAccounts.pairing.expired');
    // Active kill: the session is cancelled and our own handshake docs deleted,
    // so the dead state dies immediately instead of lingering for native TTL.
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(
      RID,
      lastSessionId(),
    );
    expect(mockDb.deletePairingHandshake).toHaveBeenCalledWith(
      RID,
      lastSessionId(),
    );
  });

  test("parent Don't Match from confirm → idle + cancelPairingSession, no delete", async () => {
    await mount();
    await reachConfirm();
    const sessionId = lastSessionId();

    await act(async () => {
      await api.declineMatch();
      await flush();
    });
    expect(api.status).toBe('idle');
    // Cancelled exactly once (by declineMatch). resetSession → endSession must
    // NOT re-issue a second terminal→CANCELLED write (permission-denied).
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(RID, sessionId);
    expect(mockDb.cancelPairingSession).toHaveBeenCalledTimes(1);
    // Declined: own docs left for the peer to read.
    expect(mockDb.deletePairingHandshake).not.toHaveBeenCalled();
  });

  test("Don't Match tears down instantly; next startPairing drains the pending cancel", async () => {
    await mount();
    await reachConfirm();
    const sessionId = lastSessionId();

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

    // Re-pair while the decline write is still in flight: startPairing drains it
    // before opening the next session.
    await act(async () => {
      const p = api.startPairing(CHILD);
      await flush();
      expect(mockDb.createPairingSession).toHaveBeenCalledTimes(1);
      resolveCancel(true);
      await p;
      await flush();
    });
    expect(mockDb.createPairingSession).toHaveBeenCalledTimes(2);
    expect(api.status).toBe('waiting');
  });
});

describe('childPairingContext — start guards', () => {
  test('createPairingSession failure → error, no destructive delete', async () => {
    mockDb.createPairingSession.mockRejectedValueOnce(new Error('denied'));
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
    expect(mockDb.cancelPairingSession).not.toHaveBeenCalled();
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
    expect(mockDb.createPairingSession).not.toHaveBeenCalled();
  });
});

describe('childPairingContext — session-identity guards (F-1/F-2/F-6/F-7)', () => {
  // F-1: async callbacks must re-check session identity after every await. A
  // childHello handler for a session that died mid-flight (and was replaced by
  // a new session) must not act on the new session's globals.

  test('T-F1a (kill path): a stale childHello resolving after decline + re-pair cannot corrupt the new session', async () => {
    await mount();
    await runStartPairing(); // session A
    const sessionA = lastSessionId();

    // A's childHello fires; its VERIFYING advance stays in flight.
    let resolveAdvance;
    mockDb.advanceSessionStatus.mockReturnValueOnce(
      new Promise(res => {
        resolveAdvance = res;
      }),
    );
    await act(async () => {
      listenerFor('childHello', sessionA)({ childEphPub: childEph.pub });
      await flush();
    });

    // The parent declines A mid-flight → session A is dead (sessionRef null).
    await act(async () => {
      await api.declineMatch();
      await flush();
    });
    expect(api.status).toBe('idle');

    // Re-pair B and drive it fully to confirm.
    childEph = makeChildEphKey();
    await runStartPairing(); // session B
    const sessionB = lastSessionId();
    expect(sessionB).not.toBe(sessionA);
    await act(async () => {
      listeners[`session:${sessionB}`]({ status: 'JOINED', joinedAt: ts(T0) });
      await flush();
    });
    await act(async () => {
      listenerFor('childHello', sessionB)({ childEphPub: childEph.pub });
      await flush();
    });
    expect(api.status).toBe('confirm');
    const sasB = api.sas;

    // A's stale advance resolves. The identity guard bails: it must not write a
    // second parentReveal on B — the only reveal on the wire is B's own
    // (written when B's childHello completed). B's SAS untouched, B's session
    // untouched.
    await act(async () => {
      resolveAdvance(true);
      await flush();
    });
    expect(api.status).toBe('confirm');
    expect(api.sas).toBe(sasB);
    expect(
      mockDb.setPairingDoc.mock.calls.filter(([, , p]) => p === 'parentReveal'),
    ).toHaveLength(1);
    // The only cancel issued is A's decline — the stale path must not re-cancel
    // or re-delete anything on B.
    expect(mockDb.cancelPairingSession).toHaveBeenCalledTimes(1);
    expect(listeners[`session:${sessionB}`]).toBeDefined();
  });

  test('T-F1b (QR): a stale childHello after re-pair cannot arm a forged Accept for the dead session', async () => {
    await mount();
    await act(async () => {
      const p = api.startPairing(CHILD, 'qr');
      await flush();
      await p;
      await flush();
    });
    expect(api.status).toBe('waiting');
    const sessionA = lastSessionId();

    let resolveAdvance;
    mockDb.advanceSessionStatus.mockReturnValueOnce(
      new Promise(res => {
        resolveAdvance = res;
      }),
    );
    await act(async () => {
      listenerFor('childHello', sessionA)({ childEphPub: childEph.pub });
      await flush();
    });

    // A dies (decline) and B (QR) starts; B's hello completes and B waits.
    await act(async () => {
      await api.declineMatch();
      await flush();
    });
    childEph = makeChildEphKey();
    await act(async () => {
      const p = api.startPairing(CHILD, 'qr');
      await flush();
      await p;
      await flush();
    });
    const sessionB = lastSessionId();
    await act(async () => {
      listenerFor('childHello', sessionB)({ childEphPub: childEph.pub });
      await flush();
    });
    expect(api.status).toBe('waiting');

    // A's stale advance resolves: the stale path (which pre-fix would
    // handshakeUnsubRef-overwrite B's childHello with a childConfirm listener
    // for dead A — the forged-Accept vector) must never subscribe.
    await act(async () => {
      resolveAdvance(true);
      await flush();
    });
    expect(api.status).toBe('waiting');
    expect(listenerFor('childConfirm', sessionA)).toBeUndefined();
    expect(listenerFor('childConfirm', sessionB)).toBeDefined();

    // B still works: the real childConfirm surfaces the Accept screen.
    await act(async () => {
      listenerFor('childConfirm', sessionB)({});
      await flush();
    });
    expect(api.status).toBe('accept');
  });

  // F-2: deliverGrant's failure handling must be scoped to the session it was
  // ending — a late failure for a dead session must not kill its replacement.

  test('T-F2: a failed grant delivery for a torn-down session cannot kill the new session', async () => {
    await mount();
    await reachConfirm(); // session A
    const sessionA = lastSessionId();

    // The grant write for A is deferred (will reject). Scoped to a single
    // call (mockImplementationOnce) so the pending promise never leaks into
    // later tests — clearAllMocks doesn't drop implementations.
    let rejectGrant;
    const grantWrite = new Promise((res, rej) => {
      rejectGrant = rej;
    });
    mockDb.setPairingDoc.mockImplementationOnce((r, s, party) =>
      party === 'grant' ? grantWrite : Promise.resolve(true),
    );

    // Match → granting → childConfirm → the grant write is in flight.
    await act(async () => {
      api.confirmMatch();
      await flush();
    });
    expect(api.status).toBe('granting');
    await act(async () => {
      listeners.childConfirm();
      await flush();
    });

    // The passive expiry (countdown anchored at session creation — WAITING →
    // T0 — and never reset by JOINED) kills A while the grant write is still
    // in flight.
    await setTick(T0 + STATE_TTL);
    expect(api.status).toBe('expired');
    expect(mockDb.cancelPairingSession).toHaveBeenCalledWith(RID, sessionA);

    // Re-pair B and drive it to confirm.
    childEph = makeChildEphKey();
    await runStartPairing(); // session B
    const sessionB = lastSessionId();
    await act(async () => {
      listeners[`session:${sessionB}`]({ status: 'JOINED', joinedAt: ts(T0) });
      await flush();
    });
    await act(async () => {
      listenerFor('childHello', sessionB)({ childEphPub: childEph.pub });
      await flush();
    });
    expect(api.status).toBe('confirm');

    // A's grant write now fails. The catch must NOT endSession on B.
    await act(async () => {
      rejectGrant(new Error('denied'));
      await flush();
    });
    expect(api.status).toBe('confirm');
    expect(mockDb.cancelPairingSession).not.toHaveBeenCalledWith(RID, sessionB);
    expect(listeners[`session:${sessionB}`]).toBeDefined();
  });

  // F-6: statusRef is set synchronously so a same-frame double entry (double
  // tap on Match / Accept) is a no-op instead of a re-entry.

  test('T-F6: double-tapping Match in the same frame subscribes childConfirm once', async () => {
    await mount();
    await reachConfirm();

    await act(async () => {
      api.confirmMatch();
      api.confirmMatch();
      await flush();
    });
    expect(api.status).toBe('granting');
    expect(
      mockDb.subscribePairingDoc.mock.calls.filter(
        ([, , p]) => p === 'childConfirm',
      ),
    ).toHaveLength(1);
  });

  test('T-F6: double-tapping Accept in the same frame delivers exactly one grant', async () => {
    await mount();
    await act(async () => {
      const p = api.startPairing(CHILD, 'qr');
      await flush();
      await p;
      await flush();
    });
    await act(async () => {
      listenerFor('childHello')({ childEphPub: childEph.pub });
      await flush();
    });
    await act(async () => {
      listeners.childConfirm();
      await flush();
    });
    expect(api.status).toBe('accept');

    await act(async () => {
      api.acceptPairing();
      api.acceptPairing();
      await flush();
    });
    expect(api.status).toBe('done');
    expect(findDocCall('grant')).toBeTruthy();
    expect(
      mockDb.setPairingDoc.mock.calls.filter(([, , p]) => p === 'grant'),
    ).toHaveLength(1);
  });
});
