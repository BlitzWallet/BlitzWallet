/* eslint-env jest */
// ---------------------------------------------------------------------------
// balanceEngine: the one mechanism that decides the displayed sats balance.
// Written before the engine (AGENTS.md rule 5). Failure modes covered:
//  F1  an increase event is not painted within the coalesce window
//  F2  a burst of events commits more than once per window
//  F3  a decrease while sending is shown (mid-send dip)
//  F4  a non-send optimization dip (owned still covers display) is shown
//  F5  a real decrease (owned dropped) is not shown
//  F6  a held decrease is never re-checked
//  F7  a re-check reads while the SDK is optimizing
//  F8  a re-check reads while a send is in flight
//  F9  a read that started before a newer commit overwrites it
//  F10 a discarded read reports success
//  F11 concurrent reads stack instead of single-flight + one rerun
//  F12 a read in flight at invalidate() lands afterwards
//  F13 a failed/timed-out read stops convergence
//  F14 a stale-high read ends convergence while the SDK disagrees
//  F15 re-checks never stop
//  F16 a claim balance applies when the SDK is not optimizing
//  F17 a claim balance lowers the display
//  F18 a claim lands over a commit made while its probe ran
//  F19 dispose() leaves timers or lets later events write
//  F20 a decrease held while sending is never re-evaluated after the send
//  F21 a non-finite event commits
//  F22 an unknown optimization probe blocks convergence forever
// ---------------------------------------------------------------------------

import { createBalanceEngine } from '../../../app/functions/spark/balanceEngine';

function setup(overrides = {}) {
  const world = {
    displayed: 5000,
    sending: false,
    active: true,
    optimizing: false,
    probeResult: undefined, // override: null = unknown
    sdkRead: 5000, // what a read returns
    readDelay: 200,
    readFails: false,
    reads: 0,
    probes: 0,
    commits: [],
  };
  const engine = createBalanceEngine({
    getDisplayed: () => world.displayed,
    commit: (value, info) => {
      world.displayed = value;
      world.commits.push({ value, ...info });
    },
    read: async () => {
      world.reads += 1;
      const value = world.sdkRead;
      const fails = world.readFails;
      await new Promise(res => setTimeout(res, world.readDelay));
      return fails
        ? { didWork: false }
        : { didWork: true, balance: value, tokensObj: { t: 1 } };
    },
    probeOptimizing: async () => {
      world.probes += 1;
      await new Promise(res => setTimeout(res, 50));
      return world.probeResult !== undefined
        ? world.probeResult
        : world.optimizing;
    },
    isSending: () => world.sending,
    isActive: () => world.active,
    ...overrides,
  });
  return { world, engine };
}

const advance = ms => jest.advanceTimersByTimeAsync(ms);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('events', () => {
  test('F1: an increase is painted within the coalesce window', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: 6000, owned: 6000 });
    await advance(400);
    expect(world.displayed).toBe(6000);
  });

  test('F2: a burst commits once, with the last value', async () => {
    const { world, engine } = setup();
    for (let i = 1; i <= 5; i++) {
      engine.onEvent({ available: 5000 + i * 10, owned: 5000 + i * 10 });
      await advance(50);
    }
    await advance(1000);
    expect(world.commits.map(c => c.value)).toEqual([5050]);
  });

  test('F1b: a sustained burst still commits by the max wait', async () => {
    const { world, engine } = setup();
    for (let i = 1; i <= 20; i++) {
      engine.onEvent({ available: 5000 + i, owned: 5000 + i });
      await advance(100);
    }
    expect(world.commits.length).toBeGreaterThanOrEqual(1);
  });

  test('F21: a non-finite event is ignored', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: NaN, owned: 1 });
    engine.onEvent({ available: undefined });
    await advance(2000);
    expect(world.commits).toEqual([]);
  });

  test('F3: a decrease while sending is held', async () => {
    const { world, engine } = setup();
    world.sending = true;
    engine.onEvent({ available: 0, owned: 5000 });
    await advance(2000);
    expect(world.displayed).toBe(5000);
  });

  test('F3b: while sending even an owned-dropping decrease waits for the send end', async () => {
    const { world, engine } = setup();
    world.sending = true;
    engine.onEvent({ available: 4000, owned: 4000 });
    await advance(5000);
    expect(world.displayed).toBe(5000);
    world.sending = false;
    engine.onSendingChange(false);
    await advance(400);
    expect(world.displayed).toBe(4000);
  });

  test('F4: an optimization dip (owned covers display) is held', async () => {
    const { world, engine } = setup();
    world.optimizing = true;
    engine.onEvent({ available: 1000, owned: 5000 });
    await advance(2000);
    expect(world.displayed).toBe(5000);
  });

  test('F5: a real decrease (owned dropped) lands', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: 3000, owned: 3000 });
    await advance(400);
    expect(world.displayed).toBe(3000);
  });

  test('missing owned on a decrease commits (never strands a spend)', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: 3000 });
    await advance(400);
    expect(world.displayed).toBe(3000);
  });
});

describe('optimization transients (device trace 2026-09-29)', () => {
  test('a decrease where owned drops too is held while the SDK optimizes', async () => {
    const { world, engine } = setup();
    world.displayed = 53640;
    world.optimizing = true;
    engine.onEvent({ available: 20872, owned: 20872 });
    await advance(2000);
    expect(world.displayed).toBe(53640);
    world.optimizing = false;
    engine.onEvent({ available: 53640, owned: 53640 });
    await advance(60000);
    expect(world.commits.map(c => c.value)).toEqual([]);
  });

  test('a read that lowers the display while the SDK optimizes is not committed', async () => {
    const { world, engine } = setup();
    world.displayed = 53640;
    world.optimizing = true;
    world.sdkRead = 20872;
    const landed = engine.settle();
    await advance(400);
    await expect(landed).resolves.toBe(false);
    expect(world.displayed).toBe(53640);
    world.optimizing = false;
    world.sdkRead = 53640;
    await advance(60000);
    expect(world.commits.every(c => c.value === 53640)).toBe(true);
  });

  test('a real decrease still lands when the SDK is not optimizing', async () => {
    const { world, engine } = setup();
    world.sdkRead = 3000;
    const landed = engine.settle();
    await advance(400);
    await expect(landed).resolves.toBe(true);
    expect(world.displayed).toBe(3000);
  });

  test('an unknown probe commits the decrease (never strands a spend)', async () => {
    const { world, engine } = setup();
    world.probeResult = null;
    engine.onEvent({ available: 3000, owned: 3000 });
    await advance(500);
    expect(world.displayed).toBe(3000);
  });

  test('a decrease newer than the probe wins over the probed one', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: 3000, owned: 3000 });
    await advance(310); // flush → probe in flight
    engine.onEvent({ available: 5000, owned: 5000 });
    await advance(1000);
    expect(world.commits.map(c => c.value)).toEqual([]);
    expect(world.displayed).toBe(5000);
  });

  test('a send decrease does not wait for a probe', async () => {
    const { world, engine } = setup();
    world.sending = true;
    world.sdkRead = 4950;
    engine.settle({ allowDuringSend: true });
    await advance(250);
    expect(world.displayed).toBe(4950);
    expect(world.probes).toBe(0);
  });
});

describe('convergence', () => {
  test('F6: a held decrease is re-checked and lands the read', async () => {
    const { world, engine } = setup();
    world.sdkRead = 4000;
    engine.onEvent({ available: 4000, owned: 5000 }); // outgoing never settles
    await advance(60000);
    expect(world.displayed).toBe(4000);
    expect(world.reads).toBeGreaterThanOrEqual(1);
  });

  test('F7: no read while the SDK reports optimizing', async () => {
    const { world, engine } = setup();
    world.optimizing = true;
    engine.onEvent({ available: 1000, owned: 5000 });
    await advance(10000);
    expect(world.reads).toBe(0);
    expect(world.probes).toBeGreaterThanOrEqual(1);
    world.optimizing = false;
    engine.onEvent({ available: 5000, owned: 5000 }); // settle event
    await advance(60000);
    expect(world.displayed).toBe(5000);
    expect(world.reads).toBe(0);
  });

  test('F8: no re-check read while a send is in flight', async () => {
    const { world, engine } = setup();
    world.sending = true;
    engine.onEvent({ available: 0, owned: 5000 });
    await advance(60000);
    expect(world.reads).toBe(0);
  });

  test('F20: a send ending re-evaluates what was held and converges', async () => {
    const { world, engine } = setup();
    world.sending = true;
    engine.onEvent({ available: 0, owned: 5000 });
    await advance(300);
    engine.onEvent({ available: 4950, owned: 5000 });
    await advance(300);
    world.sending = false;
    world.sdkRead = 4950;
    engine.onSendingChange(false);
    await advance(60000);
    expect(world.displayed).toBe(4950);
  });

  test('a send whose own settle read ran costs exactly one read', async () => {
    const { world, engine } = setup();
    world.sending = true;
    engine.onSendingChange(true);
    engine.onEvent({ available: 0, owned: 5000 });
    await advance(300);
    engine.onEvent({ available: 4950, owned: 5000 });
    world.sdkRead = 4950;
    engine.settle({ allowDuringSend: true }); // paymentWrapperTx write
    world.sending = false;
    engine.onSendingChange(false);
    await advance(60000);
    expect(world.displayed).toBe(4950);
    expect(world.reads).toBe(1);
    expect(world.probes).toBe(0);
  });

  test('a send ending while its settle read is in flight lands through that read', async () => {
    const { world, engine } = setup();
    world.sending = true;
    engine.onSendingChange(true);
    engine.onEvent({ available: 3800, owned: 3800 }); // held while sending
    await advance(400);
    world.sdkRead = 3800;
    world.readDelay = 500;
    engine.settle({ allowDuringSend: true }); // the swap's tx write
    world.sending = false;
    engine.onSendingChange(false); // flag cleared right after the write
    await advance(450);
    expect(world.commits).toEqual([]); // nothing lands ahead of the read
    await advance(100);
    expect(world.commits).toEqual([
      { value: 3800, source: 'read', tokens: { t: 1 } },
    ]);
    await advance(60000);
    expect(world.commits).toHaveLength(1);
  });

  test('a send with no read and no events during it reads once after', async () => {
    const { world, engine } = setup();
    world.sending = true;
    engine.onSendingChange(true);
    await advance(3000);
    world.sending = false;
    world.sdkRead = 4950;
    engine.onSendingChange(false);
    await advance(60000);
    expect(world.displayed).toBe(4950);
    expect(world.reads).toBe(1);
  });

  test('F13: a failed read keeps convergence going', async () => {
    const { world, engine } = setup();
    world.readFails = true;
    world.sdkRead = 4000;
    engine.onEvent({ available: 4000, owned: 5000 });
    await advance(2000);
    world.readFails = false;
    await advance(60000);
    expect(world.displayed).toBe(4000);
  });

  test('F13b: a failed settle read with no events is retried', async () => {
    const { world, engine } = setup();
    world.readFails = true;
    world.sdkRead = 5200;
    engine.settle();
    await advance(1000);
    expect(world.displayed).toBe(5000);
    world.readFails = false;
    await advance(60000);
    expect(world.displayed).toBe(5200);
  });

  test('F14: a stale-high read does not end convergence', async () => {
    const { world, engine } = setup();
    world.sdkRead = 5000; // operators still list the sent leaf
    engine.onEvent({ available: 4950, owned: 5000 });
    await advance(3000);
    expect(world.displayed).toBe(5000);
    world.sdkRead = 4950; // operators finalize
    await advance(60000);
    expect(world.displayed).toBe(4950);
  });

  test('F15: re-checks stop after a bounded budget', async () => {
    const { world, engine } = setup();
    world.sdkRead = 5000; // never agrees with the event
    engine.onEvent({ available: 4950, owned: 5000 });
    await advance(120000);
    const reads = world.reads;
    await advance(600000);
    expect(world.reads).toBe(reads);
    expect(reads).toBeLessThanOrEqual(5);
  });

  test('F22: an unknown probe does not block convergence', async () => {
    const { world, engine } = setup();
    world.probeResult = null;
    world.sdkRead = 4000;
    engine.onEvent({ available: 4000, owned: 5000 });
    await advance(60000);
    expect(world.displayed).toBe(4000);
  });

  test('settle(): an intent read that disagrees with the SDK keeps checking', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: 4950, owned: 5000 });
    await advance(400); // held: owned still covers the display
    world.sdkRead = 0; // the settle read dips
    engine.settle({ allowDuringSend: true });
    await advance(300);
    expect(world.displayed).toBe(0);
    world.sdkRead = 4950;
    await advance(60000);
    expect(world.displayed).toBe(4950);
  });

  test('settle() while sending without permission reads nothing until the send ends', async () => {
    const { world, engine } = setup();
    world.sending = true;
    engine.settle();
    await advance(5000);
    expect(world.reads).toBe(0);
    world.sending = false;
    world.sdkRead = 4800;
    engine.onSendingChange(false);
    await advance(60000);
    expect(world.displayed).toBe(4800);
  });

  test('converged state costs no extra reads', async () => {
    const { world, engine } = setup();
    world.sdkRead = 5100;
    engine.onEvent({ available: 5100, owned: 5100 });
    engine.settle({ allowDuringSend: true });
    await advance(60000);
    expect(world.reads).toBe(1);
  });
});

describe('reads', () => {
  test('F9 + F10: a read superseded by a newer commit is discarded and not landed', async () => {
    const { world, engine } = setup();
    world.readDelay = 2000;
    world.sdkRead = 5000;
    const landed = engine.read();
    await advance(100);
    engine.onEvent({ available: 6000, owned: 6000 });
    await advance(500); // event commits while the read is in flight
    await advance(2000);
    await expect(landed).resolves.toBe(false);
    expect(world.displayed).toBe(6000);
  });

  test('a landed read reports true and commits tokens', async () => {
    const { world, engine } = setup();
    world.sdkRead = 5500;
    const landed = engine.read();
    await advance(300);
    await expect(landed).resolves.toBe(true);
    expect(world.commits.at(-1)).toMatchObject({
      value: 5500,
      tokens: { t: 1 },
    });
  });

  test('F11: concurrent reads single-flight with exactly one rerun', async () => {
    const { world, engine } = setup();
    const a = engine.read();
    const b = engine.read();
    const c = engine.read();
    await advance(1000);
    await Promise.all([a, b, c]);
    expect(world.reads).toBe(2);
  });

  test('F12: a read in flight at invalidate() never lands', async () => {
    const { world, engine } = setup();
    world.readDelay = 2000;
    world.sdkRead = 1;
    const landed = engine.read();
    await advance(100);
    engine.invalidate();
    await advance(3000);
    await expect(landed).resolves.toBe(false);
    expect(world.displayed).toBe(5000);
  });

  test('invalidate() releases the single-flight so the next read starts now', async () => {
    const { world, engine } = setup();
    world.readDelay = 10000;
    engine.read();
    await advance(100);
    engine.invalidate();
    world.readDelay = 200;
    world.sdkRead = 5300;
    const landed = engine.read();
    await advance(300);
    await expect(landed).resolves.toBe(true);
    expect(world.displayed).toBe(5300);
  });

  test('a read while inactive does not commit', async () => {
    const { world, engine } = setup();
    world.sdkRead = 1;
    const landed = engine.read();
    world.active = false;
    await advance(300);
    await expect(landed).resolves.toBe(false);
    expect(world.displayed).toBe(5000);
  });
});

describe('claims', () => {
  test('claim applies upward while optimizing', async () => {
    const { world, engine } = setup();
    world.optimizing = true;
    engine.onClaim(5100);
    await advance(200);
    expect(world.displayed).toBe(5100);
  });

  test('F16: claim does not apply when not optimizing', async () => {
    const { world, engine } = setup();
    engine.onClaim(5100);
    await advance(200);
    expect(world.displayed).toBe(5000);
  });

  test('F17: claim never lowers the display', async () => {
    const { world, engine } = setup();
    world.optimizing = true;
    engine.onClaim(4000);
    await advance(200);
    expect(world.displayed).toBe(5000);
  });

  test('F18: claim loses to a commit made while its probe ran', async () => {
    const { world, engine } = setup();
    world.optimizing = true;
    engine.onClaim(5100);
    engine.onEvent({ available: 6000, owned: 6000 });
    engine.flush();
    await advance(200);
    expect(world.displayed).toBe(6000);
  });

  test('claim flushes a staged event first (balance ticks with the toast)', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: 5100, owned: 5100 });
    engine.onClaim(5100);
    expect(world.displayed).toBe(5100);
  });
});

describe('lifecycle', () => {
  test('F19: dispose clears timers and ignores later input', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: 4000, owned: 5000 }); // arms a re-check
    engine.dispose();
    engine.onEvent({ available: 9000, owned: 9000 });
    engine.onClaim(9999);
    await engine.read();
    await advance(120000);
    expect(world.commits).toEqual([]);
    expect(world.reads).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });
});
