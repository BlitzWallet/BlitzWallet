/* eslint-env jest */
// ---------------------------------------------------------------------------
// balanceEngine: the one mechanism that decides the displayed sats balance.
// Breez events carry no balance: each one only triggers a coalesced read, and
// the newest read wins. Failure modes covered:
//  E1  an event does not lead to a painted read within the coalesce window
//  E2  a burst reads more than once, or not with the last value
//  E3  a sustained burst never reads (no max wait)
//  E4  an event without a known type triggers a read
//  E6  a real decrease outside a send is held
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
  test('E1: an event leads to a painted read within the coalesce window', async () => {
    const { world, engine } = setup();
    world.sdkRead = 6000;
    engine.onEvent({ type: 'synced' });
    await advance(600);
    expect(world.displayed).toBe(6000);
  });

  test('E2: a burst reads once, with the last value', async () => {
    const { world, engine } = setup();
    for (let i = 1; i <= 5; i++) {
      world.sdkRead = 5000 + i * 10;
      engine.onEvent({ type: 'paymentSucceeded' });
      await advance(50);
    }
    await advance(1000);
    expect(world.reads).toBe(1);
    expect(world.commits.map(c => c.value)).toEqual([5050]);
  });

  test('E3: a sustained burst still reads by the max wait', async () => {
    const { world, engine } = setup();
    world.sdkRead = 5001;
    for (let i = 1; i <= 20; i++) {
      engine.onEvent({ type: 'paymentPending' });
      await advance(100);
    }
    expect(world.commits.length).toBeGreaterThanOrEqual(1);
  });

  test('E4: an event without a known type triggers no read', async () => {
    const { world, engine } = setup();
    engine.onEvent({ available: 6000 });
    engine.onEvent({ type: 'autoOptimization' });
    await advance(2000);
    expect(world.reads).toBe(0);
    expect(world.commits).toEqual([]);
  });

  test('E6: a real decrease outside a send lands', async () => {
    const { world, engine } = setup();
    world.sdkRead = 1000;
    engine.onEvent({ type: 'paymentSucceeded' });
    await advance(600);
    expect(world.displayed).toBe(1000);
  });
});

describe('sends', () => {
  test('E8: an event while sending is held', async () => {
    const { world, engine } = setup();
    world.sending = true;
    world.sdkRead = 0;
    engine.onEvent({ type: 'paymentPending' });
    await advance(2000);
    expect(world.reads).toBe(0);
    expect(world.displayed).toBe(5000);
  });

  test('E9: the send end lands the newest held event', async () => {
    const { world, engine } = setup();
    world.sending = true;
    engine.onEvent({ type: 'paymentPending' });
    engine.onEvent({ type: 'paymentSucceeded' });
    await advance(2000);
    world.sdkRead = 4000;
    world.sending = false;
    await Promise.all([engine.onSendingChange(false), advance(500)]);
    expect(world.commits.map(c => c.value)).toEqual([4000]);
  });

  test("E10: the send's settle read beats an event held before it", async () => {
    const { world, engine } = setup();
    world.sending = true;
    world.sdkRead = 0;
    engine.onEvent({ type: 'paymentPending' }); // mid-send dip, held
    await advance(400);
    world.sdkRead = 4000;
    await Promise.all([
      engine.settle({ allowDuringSend: true }),
      advance(300),
    ]);
    expect(world.displayed).toBe(4000);
    world.sending = false;
    await Promise.all([engine.onSendingChange(false), advance(500)]);
    await advance(2000);
    expect(world.displayed).toBe(4000);
    expect(world.commits.every(c => c.value === 4000)).toBe(true);
  });

  test('E10b: an event after the settle read lands at the send end', async () => {
    const { world, engine } = setup();
    world.sending = true;
    world.sdkRead = 4000;
    await Promise.all([
      engine.settle({ allowDuringSend: true }),
      advance(300),
    ]);
    world.sdkRead = 4100;
    engine.onEvent({ type: 'paymentSucceeded' });
    await advance(2000);
    world.sending = false;
    await Promise.all([engine.onSendingChange(false), advance(500)]);
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
    await advance(500);
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
    world.sdkRead = 7000;
    engine.onEvent({ type: 'paymentSucceeded' });
    await advance(1000);
    await landed;
    expect(world.displayed).toBe(7000);
    expect(world.commits.map(c => c.value)).not.toContain(3000);
  });

  test('E13: a landed read commits its tokens', async () => {
    const { world, engine } = setup();
    world.sdkRead = 5000;
    const landed = engine.read();
    await advance(300);
    await expect(landed).resolves.toEqual({ landed: true });
    expect(world.commits).toEqual([
      {
        value: 5000,
        source: 'read',
        tokens: { t: 1 },
        verified: false,
        lastVerifiedAt: 0,
      },
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
    await expect(landed).resolves.toEqual({ landed: false });
    expect(world.commits).toEqual([]);
  });

  test('E16b: a read while inactive does not commit', async () => {
    const { world, engine } = setup();
    world.active = false;
    world.sdkRead = 9000;
    const landed = engine.read();
    await advance(300);
    await expect(landed).resolves.toEqual({ landed: false });
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
    await expect(stale).resolves.toEqual({ landed: false });
    await expect(fresh).resolves.toEqual({ landed: true });
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
    engine.onEvent({ type: 'paymentSucceeded' });
    engine.dispose();
    engine.onEvent({ type: 'paymentSucceeded' });
    await expect(engine.settle()).resolves.toBe(false);
    await advance(5000);
    expect(world.commits).toEqual([]);
    expect(world.reads).toBe(0);
  });

  test('version() bumps on every commit', async () => {
    const { world, engine } = setup();
    const v = engine.version();
    world.sdkRead = 6000;
    engine.onEvent({ type: 'paymentSucceeded' });
    await advance(600);
    expect(engine.version()).toBe(v + 1);
  });
});
