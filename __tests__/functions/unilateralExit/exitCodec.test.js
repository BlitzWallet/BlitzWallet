import {
  encodeRecovery,
  decodeRecovery,
} from '../../../app/functions/unilateralExit/exitCodec';
import {
  normalizeExitTx,
  normalizeVerdict,
  normalizeExitQuote,
} from '../../../app/functions/spark/breezNormalize';
import { rnRecovery } from './fixtures/rnRecovery';
import { webRecovery } from './fixtures/webRecovery';

describe('exitCodec', () => {
  it('round-trips an RN recovery', () => {
    const out = decodeRecovery(encodeRecovery(rnRecovery));
    expect(out).toEqual(rnRecovery);
    expect(typeof out.feeRateSatPerVbyte).toBe('bigint');
    expect(out.transactions[1].status.tag).toBe('WaitingForTimelock');
    expect(out.transactions[1].status.inner.spendableAtHeight).toBe(870100);
    expect(out.recoverableValueSats).toBe(50000n);
  });

  it('round-trips a web recovery', () => {
    expect(decodeRecovery(encodeRecovery(webRecovery))).toEqual(webRecovery);
  });

  it('normalizes tx status on both runtimes', () => {
    const rn = normalizeExitTx(rnRecovery.transactions[1], true);
    const web = normalizeExitTx(webRecovery.transactions[1], false);
    expect(rn.status).toEqual({
      type: 'waitingForTimelock',
      spendableAtHeight: 870100,
    });
    expect(web.status).toEqual(rn.status);
    expect(rn.kind).toBe('refund');
    expect(rn.csvTimelockBlocks).toBeNull();
    expect(rn.cpfpTxHex).toBeNull();
    expect(normalizeExitTx(rnRecovery.transactions[0], true).status).toEqual({
      type: 'confirmed',
      blockHeight: 870000,
    });
    expect(normalizeExitTx(rnRecovery.transactions[2], true).kind).toBe(
      'sweep',
    );
  });

  it('normalizes verdicts', () => {
    expect(normalizeVerdict({ tag: 'Valid', inner: {} }, true)).toEqual({
      type: 'valid',
    });
    expect(normalizeVerdict({ type: 'done' }, false)).toEqual({ type: 'done' });
    expect(
      normalizeVerdict({ tag: 'Redo', inner: { reason: 0 } }, true),
    ).toEqual({
      type: 'redo',
      reason: 'onChainStateDiverged',
    });
    expect(
      normalizeVerdict({ type: 'redo', reason: 'onChainStateDiverged' }, false),
    ).toEqual({
      type: 'redo',
      reason: 'onChainStateDiverged',
    });
  });

  it('quote exposes leafIds', () => {
    const q = normalizeExitQuote(
      {
        recoverableValueSats: 50000n,
        totalFeeSats: 1200n,
        cooperativeFeeSats: 0n,
        refundFeeSats: 100n,
        sweepFeeSats: 100n,
        leaves: [{ leafId: 'leaf-1', method: 1 }],
        skipped: [
          {
            leafId: 'leaf-2',
            valueSats: 10n,
            reason: { tag: 'FeeExceedsValue', inner: {} },
          },
        ],
      },
      true,
    );
    expect(q.leafIds).toEqual(['leaf-1']);
    expect(q.skipped).toEqual([
      { leafId: 'leaf-2', valueSats: 10, reason: 'feeExceedsValue' },
    ]);
    expect(q.unilateralCount).toBe(1);
  });
});
