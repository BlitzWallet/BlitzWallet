/* eslint-env jest */
// Contract between the native NWC handlers (ios/NotificationService,
// android/.../nwc) and the JS handler over the shared event ledger. The
// "native" writes below are the exact statements NwcLedger issues in Swift and
// Kotlin. Ways this can fail, each covered below:
//  1. JS takes an event a native handler is still working on (double processing,
//     double pay).
//  2. An event native handed off is never picked up by JS (silent loss).
//  3. Two JS runs both take the same handed-off event.
//  4. JS reprocesses an event native already finished.
//  5. JS's own stale claims get promoted through the native lease path.
//  6. Handoff rows for finished or expired events pile up forever.
//  7. The drain does not actually run handed-off events end to end (verify,
//     respond) or also runs the finished ones in the same batch.
//  8. JS and a native handler both pass the budget check on the same total,
//     together spending past the limit.
//  9. One side's release/settle of its reservation erases the other's spend.
// 10. Two payers that both see an expired window each reset it, erasing a
//     reservation made in the new window.
// 11. A handed-off pay_invoice pays minutes later, after the client gave up.

jest.mock('expo-sqlite', () => {
  const { DatabaseSync: DB } = require('node:sqlite');
  const connections = new Map();
  return {
    __esModule: true,
    __connections: connections,
    openDatabaseAsync: jest.fn(async name => {
      if (!connections.has(name)) connections.set(name, new DB(':memory:'));
      const sqlite = connections.get(name);
      return {
        execAsync: async sql => sqlite.exec(sql),
        runAsync: async (sql, params = []) => {
          const r = sqlite.prepare(sql).run(...params);
          return { changes: r.changes, lastInsertRowId: r.lastInsertRowid };
        },
        getAllAsync: async (sql, params = []) => sqlite.prepare(sql).all(...params),
        getFirstAsync: async (sql, params = []) =>
          sqlite.prepare(sql).get(...params) ?? null,
      };
    }),
  };
});
jest.mock('../../../app/functions/nwc', () => ({
  getNWCData: jest.fn(),
  getSupportedMethods: jest.fn(() => ['get_info']),
  getSupportedNotifications: jest.fn(() => []),
  isWithinNWCBalanceTimeFrame: jest.fn(() => true),
  splitAndStoreNWCData: jest.fn(),
}));
jest.mock('../../../app/functions/nwc/publishResponse', () => ({
  publishToSingleRelay: jest.fn(async () => {}),
}));
jest.mock('../../../app/functions/nwc/cachedNWCTxs', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../app/functions/notifications', () => ({
  pushInstantNotification: jest.fn(),
}));
jest.mock('i18next', () => ({
  language: 'en',
  t: key => key,
  changeLanguage: jest.fn(async () => {}),
}));
jest.mock('../../../app/constants', () => ({
  NOSTR_RELAY_URL: 'wss://relay.example.com',
}));

const { nwcEventLedger } = require('../../../app/functions/nwc/eventLedger');
const {
  drainNativeNWCHandoffs,
} = require('../../../app/functions/nwc/backgroundNofifications');
const { getNWCData } = require('../../../app/functions/nwc');
const { publishToSingleRelay } = require('../../../app/functions/nwc/publishResponse');
const { finalizeEvent, getPublicKey, nip44 } = require('nostr-tools');

const db = () => require('expo-sqlite').__connections.get('nwc_event_ledger.db');

// NwcLedger.claim (Swift/Kotlin): claim + keep the raw event for recovery.
function nativeClaim(eventId, payload, now = Date.now()) {
  db()
    .prepare(
      `INSERT OR IGNORE INTO handled_events
       (event_id, account_pubkey, created_at, status, attempts, processed_at)
       VALUES (?, ?, ?, 'processing', 1, ?)`,
    )
    .run(eventId, 'acct', 1, now);
  db()
    .prepare('INSERT OR REPLACE INTO nwc_handoff (event_id, payload, created_at) VALUES (?, ?, ?)')
    .run(eventId, payload, now);
}
const nativeHandOff = eventId =>
  db().prepare("UPDATE handled_events SET status = 'handoff' WHERE event_id = ?").run(eventId);
const nativeFinish = eventId => {
  db().prepare("UPDATE handled_events SET status = 'done' WHERE event_id = ?").run(eventId);
  db().prepare('DELETE FROM nwc_handoff WHERE event_id = ?').run(eventId);
};
// NwcLedger.reserveSpend / adjustSpend (Swift/Kotlin), window already current.
const nativeReserve = (amountMsat, limitMsat, windowStart) => {
  db()
    .prepare(
      'INSERT OR IGNORE INTO nwc_ledger_state (account_pubkey, budget_sent_msat, window_start) VALUES (?, ?, ?)',
    )
    .run('acct', 0, windowStart);
  return (
    db()
      .prepare(
        `UPDATE nwc_ledger_state SET budget_sent_msat = budget_sent_msat + ?
         WHERE account_pubkey = ? AND window_start = ? AND (? IS NULL OR budget_sent_msat + ? <= ?)`,
      )
      .run(amountMsat, 'acct', windowStart, limitMsat, amountMsat, limitMsat)
      .changes > 0
  );
};
const nativeAdjust = (deltaMsat, windowStart) =>
  db()
    .prepare(
      `UPDATE nwc_ledger_state SET budget_sent_msat = MAX(0, budget_sent_msat + ?)
       WHERE account_pubkey = ? AND window_start = ?`,
    )
    .run(deltaMsat, 'acct', windowStart);
const sentMsat = () =>
  db().prepare("SELECT budget_sent_msat FROM nwc_ledger_state WHERE account_pubkey = 'acct'").get()
    ?.budget_sent_msat;
const jsReserve = (amountMsat, limitMsat, now, isWindowCurrent = () => true) =>
  nwcEventLedger.reserveSpend({
    accountPubkey: 'acct',
    amountMsat,
    limitMsat,
    fallbackSentMsat: 0,
    fallbackWindowStart: now,
    now,
    isWindowCurrent,
  });
const status = eventId =>
  db().prepare('SELECT status FROM handled_events WHERE event_id = ?').get(eventId)?.status;
const handoffRows = () =>
  db().prepare('SELECT event_id FROM nwc_handoff').all().map(r => r.event_id);

beforeEach(async () => {
  await nwcEventLedger.resetDatabase();
  jest.clearAllMocks();
});

describe('native/JS ledger contract', () => {
  test('JS never takes an event native is still working on (1)', async () => {
    nativeClaim('live', '{}');
    expect(await nwcEventLedger.claimEvent('live', 'acct', 1, Date.now())).toBe('busy');
    expect(await nwcEventLedger.getNativeHandoffs(Date.now())).toEqual([]);
    expect(status('live')).toBe('processing');
  });

  test('a handed-off event is claimed by exactly one JS run (2, 3)', async () => {
    nativeClaim('given', '{"id":"given"}');
    nativeHandOff('given');
    expect((await nwcEventLedger.getNativeHandoffs(Date.now())).map(r => r.event_id)).toEqual(['given']);
    const [first, second] = await Promise.all([
      nwcEventLedger.claimEvent('given', 'acct', 1, Date.now()),
      nwcEventLedger.claimEvent('given', 'acct', 1, Date.now()),
    ]);
    expect([first, second].sort()).toEqual(['busy', 'claimed']);
  });

  test('a claim abandoned by a killed native process is recovered after the lease (2)', async () => {
    const now = Date.now();
    nativeClaim('killed', '{}', now - 61_000);
    const rows = await nwcEventLedger.getNativeHandoffs(now);
    expect(rows.map(r => r.event_id)).toEqual(['killed']);
    expect(await nwcEventLedger.claimEvent('killed', 'acct', 1, now)).toBe('claimed');
  });

  test('events native finished are skipped and their rows dropped (4, 6)', async () => {
    nativeClaim('finished', '{}');
    nativeFinish('finished');
    expect(await nwcEventLedger.claimEvent('finished', 'acct', 1, Date.now())).toBe('done');
    expect(await nwcEventLedger.getNativeHandoffs(Date.now())).toEqual([]);
    expect(handoffRows()).toEqual([]);
  });

  test("JS's own stale claims are never promoted through the native lease (5)", async () => {
    const now = Date.now();
    await nwcEventLedger.claimEvent('js-owned', 'acct', 1, now - 120_000);
    expect(await nwcEventLedger.getNativeHandoffs(now)).toEqual([]);
    expect(status('js-owned')).toBe('processing');
  });

  test('JS and native can never both reserve past the budget (8)', async () => {
    const now = Date.now();
    expect(await jsReserve(600, 1000, now)).toBe(now);
    expect(nativeReserve(600, 1000, now)).toBe(false);
    expect(await jsReserve(600, 1000, now)).toBe(null);
    expect(nativeReserve(400, 1000, now)).toBe(true);
    expect(sentMsat()).toBe(1000);
  });

  test("releasing or settling a reservation keeps the other side's spend (9)", async () => {
    const now = Date.now();
    expect(await jsReserve(600, 10_000, now)).toBe(now);
    expect(nativeReserve(300, 10_000, now)).toBe(true);
    await nwcEventLedger.adjustSpend('acct', now, -600); // JS send failed
    expect(sentMsat()).toBe(300);
    nativeAdjust(50 - 100, now); // native fee came in 50 under its reserve
    expect(sentMsat()).toBe(250);
    await nwcEventLedger.adjustSpend('acct', now - 1, -250); // stale window: no-op
    expect(sentMsat()).toBe(250);
  });

  test('an expired window is reset once, not over a new reservation (10)', async () => {
    const old = Date.now() - 2 * 86_400_000;
    const now = Date.now();
    expect(nativeReserve(900, 1000, old)).toBe(true);
    const current = start => start >= now;
    expect(await jsReserve(700, 1000, now, current)).toBe(now);
    // A second payer that also saw the old window must not reset it again.
    expect(await jsReserve(200, 1000, now + 5, current)).toBe(now);
    expect(sentMsat()).toBe(900);
  });

  test('prune drops processed and expired handoff rows only (6)', async () => {
    const now = Date.now();
    nativeClaim('old', '{}', now - 10 * 60_000);
    nativeHandOff('old');
    nativeClaim('fresh', '{}', now);
    nativeHandOff('fresh');
    await nwcEventLedger.markDone('fresh-done', now);
    await nwcEventLedger.pruneNativeHandoffs(now, 300_000);
    expect(handoffRows()).toEqual(['fresh']);
  });
});

describe('drainNativeNWCHandoffs (7)', () => {
  const accountPrivateKey = '02'.repeat(32);
  const servicePubkey = getPublicKey(accountPrivateKey);
  const clientSecret = '03'.repeat(32);
  const clientPubkey = getPublicKey(clientSecret);

  // The push event shape NWC-Backend forwards and native stores verbatim.
  const pushEvent = (method = 'get_info', ageSeconds = 0) => {
    const key = nip44.getConversationKey(Buffer.from(clientSecret, 'hex'), servicePubkey);
    const signed = finalizeEvent(
      {
        kind: 23194,
        created_at: Math.floor(Date.now() / 1000) - ageSeconds,
        tags: [['p', servicePubkey]],
        content: nip44.encrypt(
          JSON.stringify({ method, params: { invoice: 'lnbc1' } }),
          key,
        ),
      },
      Buffer.from(clientSecret, 'hex'),
    );
    return { ...signed, pubkey: servicePubkey, clientPubKey: signed.pubkey };
  };

  beforeEach(() => {
    getNWCData.mockResolvedValue({
      accounts: {
        [servicePubkey]: {
          permissions: { sendPayments: true },
          privateKey: accountPrivateKey,
          publicKey: servicePubkey,
          clientPubkey,
          budgetRenewalSettings: {},
        },
      },
    });
  });

  test('runs handed-off events once, skips finished ones, and cleans up', async () => {
    const handed = pushEvent();
    const finished = pushEvent();
    nativeClaim(handed.id, JSON.stringify(handed));
    nativeHandOff(handed.id);
    nativeClaim(finished.id, JSON.stringify(finished));
    nativeFinish(finished.id);

    await drainNativeNWCHandoffs();

    expect(publishToSingleRelay).toHaveBeenCalledTimes(1);
    const [[response]] = publishToSingleRelay.mock.calls[0];
    expect(response.tags).toContainEqual(['e', handed.id]);
    expect(status(handed.id)).toBe('done');
    expect(handoffRows()).toEqual([]);

    await drainNativeNWCHandoffs();
    expect(publishToSingleRelay).toHaveBeenCalledTimes(1);
  });

  test('(11) answers a stale handed-off pay_invoice without paying', async () => {
    const stale = pushEvent('pay_invoice', 120);
    nativeClaim(stale.id, JSON.stringify(stale));
    nativeHandOff(stale.id);

    await drainNativeNWCHandoffs();

    const [[response]] = publishToSingleRelay.mock.calls.at(-1);
    expect(response.tags).toContainEqual(['e', stale.id]);
    const key = nip44.getConversationKey(Buffer.from(clientSecret, 'hex'), servicePubkey);
    expect(JSON.parse(nip44.decrypt(response.content, key))).toEqual({
      result_type: 'pay_invoice',
      error: { code: 'OTHER', message: 'Request expired' },
    });
    expect(status(stale.id)).toBe('done');
  });
});
