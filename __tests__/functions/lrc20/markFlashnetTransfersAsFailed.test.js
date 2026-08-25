// Regression tests for the O(n²) DoS in markFlashnetTransfersAsFailed.
// An attacker spamming many same-amount/same-token transfers used to trigger
// an all-pairs scan inside the amount+token group, blocking the JS thread.
// Matching semantics are pinned against a brute-force oracle so the
// optimized version must stay behavior-identical.
jest.mock('../../../app/functions/spark', () => ({
  getSparkTokenTransactions: jest.fn(async () => ({})),
}));
jest.mock('../../../app/functions/spark/flashnet', () => ({
  getActiveSwapTransferIds: jest.fn(() => new Set()),
  isSwapActive: jest.fn(() => false),
}));
jest.mock('../../../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: jest.fn(async () => {}),
  deleteSparkContactTransaction: jest.fn(async () => {}),
  getAllSparkContactInvoices: jest.fn(async () => []),
  getLatestSavedLRC20TransactionId: jest.fn(async () => null),
  getSparkTransactionBySparkId: jest.fn(async () => null),
}));

const {
  markFlashnetTransfersAsFailed,
} = require('../../../app/functions/lrc20/index');

const TOKEN_A = 'btknAAA';
const TOKEN_B = 'btknBBB';

const makeTx = ({ id, amount, token, direction, time }) => ({
  id,
  paymentStatus: 'completed',
  paymentType: 'spark',
  details: { amount, LRC20Token: token, direction, time },
});

// Brute-force oracle: mark both members of any pair sharing amount+token
// with opposite directions inside the time window. Mirrors the documented
// pairwise semantics, independent of the implementation under test.
const oracleMark = (transactions, timeWindowMs = 5000) => {
  const failed = new Set();
  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const a = transactions[i].details;
      const b = transactions[j].details;
      if (
        a.amount === b.amount &&
        a.LRC20Token === b.LRC20Token &&
        Math.abs(a.time - b.time) <= timeWindowMs &&
        ((a.direction === 'INCOMING' && b.direction === 'OUTGOING') ||
          (a.direction === 'OUTGOING' && b.direction === 'INCOMING'))
      ) {
        failed.add(i);
        failed.add(j);
      }
    }
  }
  return transactions.map((tx, i) =>
    failed.has(i) ? { ...tx, paymentStatus: 'failed' } : tx,
  );
};

// Deterministic arithmetic-only PRNG so failures are reproducible.
const mulberry32 = seed => {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

describe('markFlashnetTransfersAsFailed semantics', () => {
  it('returns the input untouched when there are fewer than 2 transactions', () => {
    const single = [
      makeTx({
        id: 'a',
        amount: 100,
        token: TOKEN_A,
        direction: 'INCOMING',
        time: 0,
      }),
    ];
    expect(markFlashnetTransfersAsFailed(single)).toBe(single);
  });

  it('marks a matching send/receive pair as failed', () => {
    const txs = [
      makeTx({
        id: 'in',
        amount: 500,
        token: TOKEN_A,
        direction: 'INCOMING',
        time: 1000,
      }),
      makeTx({
        id: 'out',
        amount: 500,
        token: TOKEN_A,
        direction: 'OUTGOING',
        time: 3000,
      }),
    ];

    const result = markFlashnetTransfersAsFailed(txs);

    expect(result[0].paymentStatus).toBe('failed');
    expect(result[1].paymentStatus).toBe('failed');
  });

  it('leaves same-direction transfers completed and returns the original array', () => {
    const txs = [
      makeTx({
        id: 'in1',
        amount: 500,
        token: TOKEN_A,
        direction: 'INCOMING',
        time: 1000,
      }),
      makeTx({
        id: 'in2',
        amount: 500,
        token: TOKEN_A,
        direction: 'INCOMING',
        time: 2000,
      }),
      makeTx({
        id: 'other',
        amount: 999,
        token: TOKEN_B,
        direction: 'OUTGOING',
        time: 1500,
      }),
    ];

    const result = markFlashnetTransfersAsFailed(txs);

    expect(result).toBe(txs);
    result.forEach(tx => expect(tx.paymentStatus).toBe('completed'));
  });

  it('ignores pairs with different amounts or different tokens', () => {
    const txs = [
      makeTx({
        id: 'in',
        amount: 500,
        token: TOKEN_A,
        direction: 'INCOMING',
        time: 1000,
      }),
      makeTx({
        id: 'outAmt',
        amount: 501,
        token: TOKEN_A,
        direction: 'OUTGOING',
        time: 1500,
      }),
      makeTx({
        id: 'outTok',
        amount: 500,
        token: TOKEN_B,
        direction: 'OUTGOING',
        time: 1500,
      }),
    ];

    const result = markFlashnetTransfersAsFailed(txs);

    expect(result).toBe(txs);
  });

  it('honors the time-window boundary (inclusive)', () => {
    const atLimit = [
      makeTx({
        id: 'in',
        amount: 500,
        token: TOKEN_A,
        direction: 'INCOMING',
        time: 10000,
      }),
      makeTx({
        id: 'out',
        amount: 500,
        token: TOKEN_A,
        direction: 'OUTGOING',
        time: 15000,
      }),
    ];
    expect(markFlashnetTransfersAsFailed(atLimit)[0].paymentStatus).toBe(
      'failed',
    );

    const pastLimit = [
      makeTx({
        id: 'in',
        amount: 500,
        token: TOKEN_A,
        direction: 'INCOMING',
        time: 10000,
      }),
      makeTx({
        id: 'out',
        amount: 500,
        token: TOKEN_A,
        direction: 'OUTGOING',
        time: 15001,
      }),
    ];
    expect(markFlashnetTransfersAsFailed(pastLimit)[0].paymentStatus).toBe(
      'completed',
    );
  });

  it('marks transfers whose counterpart is not the latest same-direction tx', () => {
    // OUT@0 matches IN@4600, and OUT@4500 matches IN@4600 — the earliest
    // OUTGOING must still be marked even though a newer OUTGOING exists.
    const txs = [
      makeTx({
        id: 'outEarly',
        amount: 700,
        token: TOKEN_A,
        direction: 'OUTGOING',
        time: 0,
      }),
      makeTx({
        id: 'outLate',
        amount: 700,
        token: TOKEN_A,
        direction: 'OUTGOING',
        time: 4500,
      }),
      makeTx({
        id: 'in',
        amount: 700,
        token: TOKEN_A,
        direction: 'INCOMING',
        time: 4600,
      }),
    ];

    const result = markFlashnetTransfersAsFailed(txs);

    expect(result.map(tx => tx.paymentStatus)).toEqual([
      'failed',
      'failed',
      'failed',
    ]);
  });

  it('does not clone transactions that stay completed', () => {
    const txs = [
      makeTx({
        id: 'in',
        amount: 500,
        token: TOKEN_A,
        direction: 'INCOMING',
        time: 1000,
      }),
      makeTx({
        id: 'out',
        amount: 500,
        token: TOKEN_A,
        direction: 'OUTGOING',
        time: 2000,
      }),
      makeTx({
        id: 'bystander',
        amount: 42,
        token: TOKEN_B,
        direction: 'INCOMING',
        time: 99999,
      }),
    ];

    const result = markFlashnetTransfersAsFailed(txs);

    expect(result[2]).toBe(txs[2]);
    expect(result[0]).not.toBe(txs[0]);
  });

  it('matches the brute-force oracle on randomized batches', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rand = mulberry32(seed);
      const count = 2 + Math.floor(rand() * 78);
      const txs = Array.from({ length: count }, (_, i) =>
        makeTx({
          id: `tx${i}`,
          amount: [100, 250, 999][Math.floor(rand() * 3)],
          token: rand() < 0.5 ? TOKEN_A : TOKEN_B,
          direction: rand() < 0.5 ? 'INCOMING' : 'OUTGOING',
          time: Math.floor(rand() * 20000),
        }),
      );

      expect(markFlashnetTransfersAsFailed(txs)).toEqual(oracleMark(txs));
    }
  });
});

describe('markFlashnetTransfersAsFailed spam-batch performance', () => {
  // DoS repro (offline, synthetic data only): one poll returning thousands of
  // same-amount/same-token transfers must not require an all-pairs scan.
  it('processes a large adversarial same-group batch quickly', () => {
    const count = 20000;
    const txs = Array.from({ length: count }, (_, i) =>
      makeTx({
        id: `tx${i}`,
        amount: 100,
        token: TOKEN_A,
        direction: i % 2 === 0 ? 'INCOMING' : 'OUTGOING',
        time: 1000000 + (i % 2) * 10, // everything inside the window
      }),
    );

    const start = Date.now();
    const result = markFlashnetTransfersAsFailed(txs);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
    expect(result.every(tx => tx.paymentStatus === 'failed')).toBe(true);
  }, 30000);

  it('handles a large batch of unrelated groups without marking anything', () => {
    const count = 20000;
    const txs = Array.from({ length: count }, (_, i) =>
      makeTx({
        id: `tx${i}`,
        amount: i, // unique amount per tx -> no group ever has 2 members
        token: TOKEN_A,
        direction: i % 2 === 0 ? 'INCOMING' : 'OUTGOING',
        time: i,
      }),
    );

    const start = Date.now();
    const result = markFlashnetTransfersAsFailed(txs);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
    expect(result).toBe(txs);
  }, 30000);

  describe('rows with an unparseable timestamp', () => {
    // details.time is `new Date(clientCreatedTimestamp).getTime()`, which is
    // NaN whenever the SDK omits or mangles the field. Every comparison
    // against NaN is false, so such a row can neither match a window nor be
    // matched against — and left in the sorted sweep it would stall the
    // forward-only pointer for the rest of its group.
    it('leaves a pair with unknown times visible instead of hiding it', () => {
      const txs = [
        makeTx({
          id: 'in',
          amount: 500,
          token: TOKEN_A,
          direction: 'INCOMING',
          time: NaN,
        }),
        makeTx({
          id: 'out',
          amount: 500,
          token: TOKEN_A,
          direction: 'OUTGOING',
          time: NaN,
        }),
      ];

      const result = markFlashnetTransfersAsFailed(txs);

      expect(result.map(tx => tx.paymentStatus)).toEqual([
        'completed',
        'completed',
      ]);
    });

    it('does not let an unknown time suppress detection for the rest of its group', () => {
      const txs = [
        makeTx({
          id: 'poison',
          amount: 500,
          token: TOKEN_A,
          direction: 'OUTGOING',
          time: undefined,
        }),
        makeTx({
          id: 'in',
          amount: 500,
          token: TOKEN_A,
          direction: 'INCOMING',
          time: 20000,
        }),
        makeTx({
          id: 'out',
          amount: 500,
          token: TOKEN_A,
          direction: 'OUTGOING',
          time: 21000,
        }),
      ];

      const result = markFlashnetTransfersAsFailed(txs);
      const byId = Object.fromEntries(
        result.map(tx => [tx.id, tx.paymentStatus]),
      );

      // The genuine swap pair behind the bad row is still detected...
      expect(byId.in).toBe('failed');
      expect(byId.out).toBe('failed');
      // ...and the unverifiable row stays visible rather than being hidden.
      expect(byId.poison).toBe('completed');
    });
  });
});
