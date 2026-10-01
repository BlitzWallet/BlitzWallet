/* eslint-env jest */
// ---------------------------------------------------------------------------
// balanceEngine: the one mechanism that decides the displayed sats balance.
// Written before the engine (AGENTS.md rule 5). Failure modes covered:
//  E1  an increase event is not painted within the coalesce window
//  E2  a burst commits more than once, or not with the last value
//  E3  a sustained burst never commits (no max wait)
//  E4  a non-finite event commits
//  E5  an optimization dip shows (optimizationLocked not counted)
//  E6  a real decrease outside a send is held
//  E7  an event equal to the display commits (spurious reconcile)
//  E8  an event lands while sending (mid-send leaf-lock dip shown)
//  E9  a send's end never lands what was held
//  E10 a send's end lands a held event older than the send's settle read
//  E11 a send's end resolves before its in-flight settle read landed
//  E12 a read lands over an event that arrived while it was in flight
//  E13 a landed read drops its tokens
//  E14 concurrent reads stack instead of single-flight + one rerun
//  E15 settle() reads during a send without permission
//  E16 a failed read, or a read while inactive, commits
//  E17 invalidate() keeps a hung read blocking the next one
//  E18 dispose() leaves timers or lets later input write
//  E19 a failed settle read is never retried (missed change stays hidden)
//  E20 settle retries never stop
//  E21 a settle read that lost to a newer event is retried (wasted reads)
//  E22 a retry reads during a send, or survives invalidate()
// ---------------------------------------------------------------------------

import { createBalanceEngine } from '../../../app/functions/spark/balanceEngine';

function setup() {
  const world = {
    displayed: 5000,
    sending: false,
    active: true,
    sdkRead: 5000, // what a read returns
    readDelay: 200,
    readFails: false,
    reads: 0,
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
    isSending: () => world.sending,
    isActive: () => world.active,
  });
  return { world, engine };
}

const advance = ms => jest.advanceTimersByTimeAsync(ms);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('events', () => {
  test('E1: an increase is painted within the coalesce window', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: 6000 });
    await advance(400);
    expect(world.displayed).toBe(6000);
  });

  test('E2: a burst commits once, with the last value', async () => {
    const { world, engine } = setup();
    for (let i = 1; i <= 5; i++) {
      engine.onEvent({ available: 5000 + i * 10 });
      await advance(50);
    }
    await advance(1000);
    expect(world.commits.map(c => c.value)).toEqual([5050]);
  });

  test('E3: a sustained burst still commits by the max wait', async () => {
    const { world, engine } = setup();
    for (let i = 1; i <= 20; i++) {
      engine.onEvent({ available: 5000 + i });
      await advance(100);
    }
    expect(world.commits.length).toBeGreaterThanOrEqual(1);
  });

  test('E4: a non-finite event is ignored', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: NaN });
    engine.onEvent({ available: undefined });
    await advance(2000);
    expect(world.commits).toEqual([]);
  });

  test('E5: optimization-locked leaves count (device trace 2026-09-30)', async () => {
    const { world, engine } = setup();
    world.displayed = 81864;
    engine.onEvent({ available: 49096, optimizationLocked: 32768 });
    await advance(2000);
    expect(world.commits).toEqual([]);
    expect(world.displayed).toBe(81864);
  });

  test('E5b: a missing optimizationLocked counts as 0', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: 4000 });
    await advance(400);
    expect(world.displayed).toBe(4000);
  });

  test('E6: a real decrease outside a send lands', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: 1000, optimizationLocked: 0 });
    await advance(400);
    expect(world.displayed).toBe(1000);
  });

  test('E7: an event equal to the display does not commit', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: 5000 });
    await advance(2000);
    expect(world.commits).toEqual([]);
  });
});

describe('sends', () => {
  test('E8: an event while sending is held', async () => {
    const { world, engine } = setup();
    world.sending = true;
    engine.onEvent({ available: 0 });
    await advance(2000);
    expect(world.displayed).toBe(5000);
  });

  test('E9: the send end lands the newest held event', async () => {
    const { world, engine } = setup();
    world.sending = true;
    engine.onEvent({ available: 0 });
    engine.onEvent({ available: 4000 });
    await advance(2000);
    world.sending = false;
    await engine.onSendingChange(false);
    expect(world.commits.map(c => c.value)).toEqual([4000]);
  });

  test("E10: the send's settle read beats an event held before it", async () => {
    const { world, engine } = setup();
    world.sending = true;
    engine.onEvent({ available: 0 }); // mid-send dip
    await advance(400);
    world.sdkRead = 4000;
    await Promise.all([
      engine.settle({ allowDuringSend: true }),
      advance(300),
    ]);
    expect(world.displayed).toBe(4000);
    world.sending = false;
    await engine.onSendingChange(false);
    await advance(2000);
    expect(world.commits.map(c => c.value)).toEqual([4000]);
  });

  test('E10b: an event after the settle read lands at the send end', async () => {
    const { world, engine } = setup();
    world.sending = true;
    world.sdkRead = 4000;
    await Promise.all([
      engine.settle({ allowDuringSend: true }),
      advance(300),
    ]);
    engine.onEvent({ available: 4100 });
    await advance(2000);
    world.sending = false;
    await engine.onSendingChange(false);
    expect(world.commits.map(c => c.value)).toEqual([4000, 4100]);
  });

  test('E11: the send end resolves only after its settle read landed', async () => {
    const { world, engine } = setup();
    world.sending = true;
    world.sdkRead = 4000;
    engine.settle({ allowDuringSend: true });
    world.sending = false;
    let released = false;
    engine.onSendingChange(false).then(() => {
      released = true;
    });
    await advance(100);
    expect(released).toBe(false);
    await advance(200);
    expect(released).toBe(true);
    expect(world.displayed).toBe(4000);
  });

  test('E15: settle() while sending without permission reads nothing', async () => {
    const { world, engine } = setup();
    world.sending = true;
    await expect(engine.settle()).resolves.toBe(false);
    expect(world.reads).toBe(0);
  });
});

describe('reads', () => {
  test('E12: a read loses to an event that arrived while it was in flight', async () => {
    const { world, engine } = setup();
    world.sdkRead = 3000;
    const landed = engine.read();
    await advance(50);
    engine.onEvent({ available: 7000 });
    await advance(1000);
    await expect(landed).resolves.toBe(false);
    expect(world.displayed).toBe(7000);
  });

  test('E12b: a read clears an older staged event', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: 6000 });
    world.sdkRead = 6500;
    // Read starts after the event arrived but lands inside its coalesce window
    world.readDelay = 100;
    const landed = engine.read();
    await advance(1000);
    await expect(landed).resolves.toBe(true);
    expect(world.commits.map(c => c.value)).toEqual([6500]);
  });

  test('E13: a landed read commits its tokens', async () => {
    const { world, engine } = setup();
    world.sdkRead = 5000;
    const landed = engine.read();
    await advance(300);
    await expect(landed).resolves.toBe(true);
    expect(world.commits).toEqual([
      { value: 5000, source: 'read', tokens: { t: 1 } },
    ]);
  });

  test('E14: concurrent reads single-flight with exactly one rerun', async () => {
    const { world, engine } = setup();
    engine.read();
    engine.read();
    engine.read();
    await advance(1000);
    expect(world.reads).toBe(2);
  });

  test('E16: a failed read does not commit', async () => {
    const { world, engine } = setup();
    world.readFails = true;
    const landed = engine.read();
    await advance(300);
    await expect(landed).resolves.toBe(false);
    expect(world.commits).toEqual([]);
  });

  test('E16b: a read while inactive does not commit', async () => {
    const { world, engine } = setup();
    world.active = false;
    world.sdkRead = 9000;
    const landed = engine.read();
    await advance(300);
    await expect(landed).resolves.toBe(false);
    expect(world.displayed).toBe(5000);
  });

  test('E17: invalidate() voids the in-flight read and frees the next', async () => {
    const { world, engine } = setup();
    world.sdkRead = 1111;
    const stale = engine.read();
    await advance(50);
    engine.invalidate();
    world.sdkRead = 2222;
    const fresh = engine.read();
    await advance(1000);
    await expect(stale).resolves.toBe(false);
    await expect(fresh).resolves.toBe(true);
    expect(world.commits.map(c => c.value)).toEqual([2222]);
  });
});

describe('settle retries', () => {
  test('E19: a failed settle read is retried until it lands', async () => {
    const { world, engine } = setup();
    world.readFails = true;
    world.sdkRead = 8000;
    engine.settle();
    await advance(3000);
    world.readFails = false;
    await advance(10000);
    expect(world.displayed).toBe(8000);
  });

  test('E20: settle retries stop after a bounded budget', async () => {
    const { world, engine } = setup();
    world.readFails = true;
    engine.settle();
    await advance(120000);
    const reads = world.reads;
    await advance(600000);
    expect(world.reads).toBe(reads);
    expect(reads).toBeLessThanOrEqual(4);
  });

  test('E21: a settle read that lost to a newer event is not retried', async () => {
    const { world, engine } = setup();
    engine.settle();
    await advance(50);
    engine.onEvent({ available: 7000 });
    await advance(60000);
    expect(world.reads).toBe(1);
    expect(world.displayed).toBe(7000);
  });

  test('E22: no retry while sending', async () => {
    const { world, engine } = setup();
    world.readFails = true;
    engine.settle();
    await advance(300);
    world.sending = true;
    await advance(60000);
    expect(world.reads).toBe(1);
  });

  test('E22b: invalidate() cancels a pending retry', async () => {
    const { world, engine } = setup();
    world.readFails = true;
    engine.settle();
    await advance(300);
    engine.invalidate();
    await advance(60000);
    expect(world.reads).toBe(1);
  });
});

describe('lifecycle', () => {
  test('E18: dispose clears timers and ignores later input', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: 6000 });
    engine.dispose();
    engine.onEvent({ available: 7000 });
    await expect(engine.settle()).resolves.toBe(false);
    await advance(5000);
    expect(world.commits).toEqual([]);
    expect(world.reads).toBe(0);
  });

  test('version() bumps on every commit', async () => {
    const { engine } = setup();
    const v = engine.version();
    engine.onEvent({ available: 6000 });
    await advance(400);
    expect(engine.version()).toBe(v + 1);
  });
});
