import {
  exitView,
  heldCoopSats,
} from '../../../app/functions/unilateralExit/exitView';
import { encodeRecovery } from '../../../app/functions/unilateralExit/exitCodec';

const tx = (txid, status, extra = {}) => ({
  kind: 'node',
  txid,
  txHex: 'h',
  dependsOn: [],
  status,
  ...extra,
});
const rec = (over = {}, txs = null) => ({
  status: 'active',
  quote: { recoverableSats: 50000, receiveSats: 49000, fundingSats: 5000 },
  needMoreSats: 1234,
  failedLeafIds: ['a'],
  refusals: { x: 'no', y: 'no' },
  feeSeen: null,
  lastCheckedAt: 1,
  recovery: txs ? encodeRecovery({ transactions: txs, failed: [] }) : null,
  ...over,
});

describe('exitView', () => {
  it('computes blocks left across a dependency chain', () => {
    const r = rec({}, [
      tx('a', { type: 'confirmed', blockHeight: 90 }),
      tx(
        'b',
        { type: 'waitingForTimelock', spendableAtHeight: 105 },
        {
          dependsOn: ['a'],
        },
      ),
      tx(
        'c',
        { type: 'waitingForDependencies' },
        {
          dependsOn: ['b'],
          csvTimelockBlocks: 144,
        },
      ),
    ]);
    const v = exitView(r, 100);
    expect(v.stepsDone).toBe(1);
    expect(v.stepsTotal).toBe(3);
    expect(v.blocksLeft).toBe(5 + 1 + 144);
    expect(v.nextMaturityBlocks).toBe(5);
    expect(v.phase).toBe('waitingConfirmation');
    expect(v.failedLeafCount).toBe(1);
    expect(v.refusalCount).toBe(2);
  });

  it('returns the normalized txs', () => {
    const v = exitView(rec({}, [tx('a', { type: 'ready' })]), 100);
    expect(v.txs.map(t => t.txid)).toEqual(['a']);
  });

  it('null without tip', () => {
    const r = rec({}, [
      tx('a', { type: 'waitingForTimelock', spendableAtHeight: 105 }),
    ]);
    const v = exitView(r, null);
    expect(v.blocksLeft).toBeNull();
    expect(v.nextMaturityBlocks).toBeNull();
    expect(v.phase).toBe('chainUnavailable');
  });

  it('maps awaitingFee with received amount', () => {
    const v = exitView(
      rec({
        status: 'awaitingFee',
        feeSeen: { confirmedSats: 1000, pendingSats: 500 },
      }),
      100,
    );
    expect(v.phase).toBe('awaitingFee');
    expect(v.feeNeededSats).toBe(5000);
    expect(v.feeReceivedSats).toBe(1500);
    expect(v.feePendingSats).toBe(500);
    expect(v.amountSats).toBe(50000);
    expect(v.receiveSats).toBe(49000);
    expect(exitView(rec({ status: 'needsMoreFee' }), 100).feeNeededSats).toBe(
      1234,
    );
  });

  it('picks sending, timelock and updating phases', () => {
    const ready = [tx('a', { type: 'ready' })];
    expect(exitView(rec({ lastCheckedAt: null }, ready), 100).phase).toBe(
      'sending',
    );
    expect(exitView(rec({}, ready), 100).phase).toBe('waitingConfirmation');
    const lock = [
      tx('a', { type: 'waitingForTimelock', spendableAtHeight: 120 }),
    ];
    expect(exitView(rec({}, lock), 100).phase).toBe('waitingTimelock');
    const done = [tx('a', { type: 'confirmed', blockHeight: 1 })];
    expect(exitView(rec({}, done), 100).phase).toBe('updating');
  });

  it('view survives an unparseable recovery', () => {
    const v = exitView(rec({ recovery: 'not json' }), 100);
    expect(v.stepsTotal).toBe(0);
    expect(v.phase).toBe('updating');
  });

  it('never yields NaN for a timelock tx without a height', () => {
    const v = exitView(rec({}, [tx('a', { type: 'waitingForTimelock' })]), 100);
    expect(v.blocksLeft).toBe(1);
    expect(v.nextMaturityBlocks).toBeNull();
  });

  it('counts a ready tx as one block regardless of its timelock', () => {
    const v = exitView(
      rec({}, [tx('a', { type: 'ready' }, { csvTimelockBlocks: 144 })]),
      100,
    );
    expect(v.blocksLeft).toBe(1);
  });
});

describe('heldCoopSats', () => {
  const recOf = (txs, leaves) => ({
    recovery: encodeRecovery({ transactions: txs, leaves, failed: [] }),
  });
  const coop = (txid, nodeId, status) => ({
    txid,
    nodeId,
    kind: 'cooperative',
    status: { type: status },
  });
  it('counts co-signed leaves whose recovery is not confirmed', () => {
    const r = recOf(
      [coop('a', 'L1', 'ready'), coop('b', 'L2', 'confirmed')],
      [
        { leafId: 'L1', valueSats: 1000 },
        { leafId: 'L2', valueSats: 500 },
        { leafId: 'L3', valueSats: 70 },
      ],
    );
    expect(heldCoopSats([r, { recovery: null }, { recovery: '{bad' }])).toBe(
      1000,
    );
  });
});
