jest.mock('i18next', () => ({ t: k => k }));

import {
  runExitPass,
  isStalled,
  retryDue,
} from '../../../app/functions/unilateralExit/exitPass';
import {
  encodeRecovery,
  decodeRecovery,
} from '../../../app/functions/unilateralExit/exitCodec';
import { classifyBreezError } from '../../../app/functions/spark/breezErrors';

const feeKey = { address: 'bc1qfee', publicKeyHex: '02pub', secretKey: 'sk' };
const coin = (n, valueSats = 6000, confirmed = true) => ({
  txid: `c${n}`,
  vout: 0,
  valueSats,
  confirmed,
});
const input = c => ({
  txid: c.txid,
  vout: c.vout,
  valueSats: c.valueSats,
  pubkey: '02pub',
});
const tx = (txid, status, extra = {}) => ({
  kind: 'node',
  txid,
  txHex: `hex-${txid}`,
  dependsOn: [],
  status: { type: status },
  ...extra,
});
const rawQuote = (fundingSats = 5000) => ({
  recoverableValueSats: 50000,
  totalFeeSats: 1000,
  cooperativeFeeSats: 0,
  refundFeeSats: 0,
  sweepFeeSats: 0,
  funding: fundingSats ? { singleUtxoSats: fundingSats } : undefined,
  leaves: [{ leafId: 'L1', method: 'unilateral' }],
  skipped: [],
});
const quoteOf = (leaves, skipped = [], extra = {}) => ({
  ...rawQuote(0),
  leaves,
  skipped,
  ...extra,
});
const skip = (leafId, type) => ({ leafId, valueSats: 50000, reason: { type } });
const leaf = (leafId, method = 'unilateral') => ({
  leafId,
  valueSats: 50000,
  method,
});
const built = (txs, leaves = ['L1']) => ({
  transactions: txs,
  leaves: leaves.map(id => leaf(id)),
  failed: [{ leafId: 'F1' }],
});
const coopTx = (txid, status, nodeId) =>
  tx(txid, status, { kind: 'cooperative', nodeId });
const baseRecord = (over = {}) => ({
  v: 1,
  identity: 'id',
  status: 'awaitingFee',
  destination: 'bc1qdest',
  feeRate: 5,
  leafIds: ['L1'],
  quote: { fundingSats: 5000 },
  fundingInputs: [],
  recovery: null,
  refusals: {},
  needMoreSats: 0,
  bumpRequested: false,
  failedLeafIds: [],
  tipHeight: 100,
  lastCheckedAt: null,
  ...over,
});

function setup({ utxos = [], quote = rawQuote(), tip = 1000 } = {}) {
  const order = [];
  const handle = {
    quoteExit: jest.fn(async () => quote),
    buildExit: jest.fn(async () => built([tx('t1', 'ready')])),
    checkExit: jest.fn(),
    importExitState: jest.fn(async () => ({})),
  };
  const chain = {
    getTipHeight: jest.fn(async () => tip),
    getAddressUtxos: jest.fn(async () => utxos),
    broadcastTx: jest.fn(async () => order.push('tx')),
    broadcastPackage: jest.fn(async () => order.push('pkg')),
  };
  const save = jest.fn(async r => {
    order.push(r.recovery ? 'save:recovery' : 'save');
    return { ...r, revision: 1 };
  });
  const run = record =>
    runExitPass({
      record,
      handle,
      chain,
      feeKey,
      save,
      rn: false,
      now: () => 777,
    });
  return { order, handle, chain, save, run };
}

const shortBuild = (s, requiredSats) =>
  s.handle.buildExit.mockRejectedValue({
    tag: 'InsufficientCpfpFunds',
    inner: { requiredSats },
  });

const activeRecord = (over = {}) =>
  baseRecord({
    status: 'active',
    recovery: encodeRecovery(built([tx('t0', 'ready')])),
    fundingInputs: [input(coin(1))],
    failedLeafIds: ['F1'],
    ...over,
  });
const checked = (txs, type = 'valid') => ({
  recovery: built(txs),
  verdict: { type },
});

describe('runExitPass', () => {
  it('does nothing while the fee address is empty', async () => {
    const s = setup();
    const rec = baseRecord();
    expect(await s.run(rec)).toBe(rec);
    expect(s.save).not.toHaveBeenCalled();
    expect(s.handle.buildExit).not.toHaveBeenCalled();
  });

  it('waits for a confirmation', async () => {
    const s = setup({ utxos: [coin(1, 9000, false)] });
    await s.run(baseRecord());
    expect(s.handle.buildExit).not.toHaveBeenCalled();
    expect(s.save.mock.calls[0][0].feeSeen).toEqual({
      confirmedSats: 0,
      pendingSats: 9000,
    });
  });

  it('asks for more when fees rose', async () => {
    const s = setup({ utxos: [coin(1, 3800)] });
    const out = await s.run(baseRecord());
    expect(out.status).toBe('needsMoreFee');
    expect(out.needMoreSats).toBe(1200);
    expect(s.handle.buildExit).not.toHaveBeenCalled();
  });

  it('builds with every confirmed fee coin', async () => {
    const s = setup({ utxos: [coin(1), coin(2), coin(3, 100, false)] });
    await s.run(baseRecord());
    expect(s.handle.buildExit.mock.calls[0][1]).toEqual([
      input(coin(1)),
      input(coin(2)),
    ]);
    expect(s.handle.buildExit.mock.calls[0][2]).toBe('sk');
  });

  it('builds without fee coins when the quote needs no funding', async () => {
    const s = setup({ quote: rawQuote(0) });
    await s.run(baseRecord({ quote: { fundingSats: 0 } }));
    expect(s.handle.buildExit.mock.calls[0][1]).toEqual([]);
  });

  it('saves recovery before the first broadcast', async () => {
    const s = setup({ utxos: [coin(1), coin(2)] });
    const out = await s.run(baseRecord());
    expect(s.order.indexOf('save:recovery')).toBeGreaterThanOrEqual(0);
    expect(s.order.indexOf('save:recovery')).toBeLessThan(
      s.order.indexOf('tx'),
    );
    expect(out.status).toBe('active');
    expect(out.failedLeafIds).toEqual([]);
    expect(out.needMoreSats).toBe(0);
  });

  it('broadcasts only ready steps, pairs as packages', async () => {
    const s = setup();
    s.handle.checkExit.mockResolvedValue(
      checked([
        tx('a', 'ready', { cpfpTxHex: 'cpfp-a' }),
        tx('b', 'ready'),
        tx('c', 'waitingForTimelock'),
        tx('d', 'confirmed'),
        tx('e', 'unverified'),
      ]),
    );
    await s.run(activeRecord());
    expect(s.chain.broadcastPackage).toHaveBeenCalledWith('hex-a', 'cpfp-a');
    expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-b']]);
  });

  it('sends cooperative steps while unverified', async () => {
    const s = setup();
    shortBuild(s, 5000);
    s.handle.checkExit.mockResolvedValue(
      checked([
        tx('a', 'unverified', { kind: 'cooperative' }),
        tx('b', 'unverified'),
      ]),
    );
    await s.run(activeRecord());
    expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-a']]);
  });

  it('keeps going when a broadcast is refused', async () => {
    const s = setup();
    s.handle.checkExit.mockResolvedValue(
      checked([tx('a', 'ready'), tx('b', 'ready')]),
    );
    s.chain.broadcastTx.mockRejectedValueOnce(new Error('nope'));
    const out = await s.run(activeRecord({ refusals: { b: 'old' } }));
    expect(s.chain.broadcastTx).toHaveBeenCalledTimes(2);
    expect(out.refusals).toEqual({ a: 'nope' });
    expect(out.lastCheckedAt).toBe(777);
    expect(out.tipHeight).toBe(1000);
  });

  it('treats an unparseable stored recovery as redo', async () => {
    const s = setup({ utxos: [coin(1)] });
    await s.run(activeRecord({ recovery: '{broken' }));
    expect(s.handle.checkExit).not.toHaveBeenCalled();
    expect(s.handle.buildExit).toHaveBeenCalled();
  });

  it('rebuilds on redo with stored funding inputs and the same leaf ids', async () => {
    const s = setup({ utxos: [coin(1), coin(2)] });
    s.handle.checkExit.mockResolvedValue(checked([], 'redo'));
    const out = await s.run(activeRecord());
    expect(s.handle.quoteExit).toHaveBeenCalledWith({
      destination: 'bc1qdest',
      feeRate: 5,
      leafIds: ['L1'],
    });
    expect(s.handle.buildExit.mock.calls[0][1]).toEqual([
      input(coin(1)),
      input(coin(2)),
    ]);
    expect(out.fundingInputs).toHaveLength(2);
  });

  it('keeps stored funding inputs the chain no longer lists', async () => {
    const s = setup({ utxos: [coin(2)] });
    s.handle.checkExit.mockResolvedValue(checked([], 'redo'));
    await s.run(activeRecord());
    expect(s.handle.buildExit.mock.calls[0][1]).toEqual([
      input(coin(1)),
      input(coin(2)),
    ]);
  });

  it('passes an input listed both stored and on chain once', async () => {
    const s = setup({ utxos: [coin(1)] });
    s.handle.checkExit.mockResolvedValue(checked([], 'redo'));
    await s.run(activeRecord());
    expect(s.handle.buildExit.mock.calls[0][1]).toEqual([input(coin(1))]);
  });

  it('replaces the stored recovery with the checked one', async () => {
    const s = setup();
    s.handle.checkExit.mockResolvedValue(
      checked([tx('z', 'waitingForTimelock')]),
    );
    const out = await s.run(activeRecord());
    expect(decodeRecovery(out.recovery).transactions[0].txid).toBe('z');
    expect(s.chain.broadcastTx).not.toHaveBeenCalled();
  });

  it('marks done', async () => {
    const s = setup();
    s.handle.checkExit.mockResolvedValue(
      checked([tx('a', 'confirmed')], 'done'),
    );
    const rec = activeRecord();
    const out = await s.run(rec);
    expect(out.status).toBe('done');
    expect(out.recovery).toBe(rec.recovery);
    expect(s.chain.broadcastTx).not.toHaveBeenCalled();
  });

  describe('a requested bump (R-3)', () => {
    const readyChecked = () => checked([tx('a', 'ready')]);
    const bumpRec = (over = {}) =>
      activeRecord({ bumpRequested: true, feeRate: 9, ...over });

    it('rebuilds at a higher fee when asked', async () => {
      const s = setup({ utxos: [coin(1, 6000)] });
      s.handle.checkExit.mockResolvedValue(readyChecked());
      const out = await s.run(bumpRec());
      expect(s.handle.checkExit).toHaveBeenCalled();
      expect(s.handle.quoteExit.mock.calls[0][0].feeRate).toBe(9);
      expect(out.bumpRequested).toBe(false);
    });

    it('a short bump stays requested, broadcasts the checked recovery', async () => {
      const s = setup({ utxos: [coin(1, 1000)], quote: rawQuote(5000) });
      shortBuild(s, 5000);
      s.handle.checkExit.mockResolvedValue(readyChecked());
      const out = await s.run(bumpRec());
      expect(out.status).toBe('active');
      expect(decodeRecovery(out.recovery).transactions[0].txid).toBe('a');
      expect(out.bumpRequested).toBe(true);
      expect(out.needMoreSats).toBe(4000);
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-a']]);
    });

    it('builds with the stored input while the only coin is unconfirmed change', async () => {
      const s = setup({ utxos: [coin(2, 6000, false)] });
      s.handle.checkExit.mockResolvedValue(readyChecked());
      const out = await s.run(bumpRec());
      expect(s.handle.buildExit.mock.calls[0][1]).toEqual([input(coin(1))]);
      expect(out.bumpRequested).toBe(false);
    });

    it('an insufficient-funds build keeps the bump pending and retries when funded', async () => {
      const s = setup({ utxos: [coin(3, 3000), coin(4, 2000, false)] });
      s.handle.checkExit.mockResolvedValue(readyChecked());
      s.handle.buildExit.mockRejectedValueOnce({
        tag: 'InsufficientCpfpFunds',
        inner: { requiredSats: 9000 },
        message: 'SdkError.InsufficientCpfpFunds',
      });
      const out = await s.run(bumpRec());
      expect(out.needMoreSats).toBe(4000);
      expect(out.bumpRequested).toBe(true);
      expect(out.status).toBe('active');
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-a']]);

      s.handle.quoteExit.mockClear();
      s.handle.buildExit.mockClear();
      await s.run(out);
      expect(s.handle.quoteExit).toHaveBeenCalled();
      expect(s.handle.buildExit).toHaveBeenCalled();
    });

    it('a failed bump build is undone, still broadcasts, then rethrows', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockResolvedValue(readyChecked());
      s.handle.buildExit.mockRejectedValue(new Error('boom'));
      await expect(
        s.run(bumpRec({ bumpFrom: { feeRate: 5, tempBump: null } })),
      ).rejects.toThrow('boom');
      expect(s.handle.checkExit).toHaveBeenCalled();
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-a']]);
      const saved = s.save.mock.calls.find(
        c => c[0].bumpRequested === false,
      )[0];
      expect(saved.feeRate).toBe(5);
      expect(saved.bumpFrom).toBeNull();
      expect(saved.needMoreSats).toBe(0);
    });

    it('a fee-address read failure keeps the bump and broadcasts', async () => {
      const s = setup();
      s.chain.getAddressUtxos.mockRejectedValue(new Error('down'));
      s.handle.checkExit.mockResolvedValue(readyChecked());
      const out = await s.run(bumpRec());
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-a']]);
      expect(out.bumpRequested).toBe(true);
    });
  });

  it('keeps a temporary bump while its steps are unconfirmed', async () => {
    const s = setup();
    s.handle.checkExit.mockResolvedValue(checked([tx('a', 'ready')]));
    const out = await s.run(
      activeRecord({ feeRate: 9, tempBump: { baseFeeRate: 5, txids: ['a'] } }),
    );
    expect(s.handle.quoteExit).not.toHaveBeenCalled();
    expect(out.feeRate).toBe(9);
    expect(out.tempBump).toEqual({ baseFeeRate: 5, txids: ['a'] });
  });

  it('adds steps broadcast during a temporary bump', async () => {
    const s = setup();
    s.handle.checkExit.mockResolvedValue(
      checked([tx('a', 'ready'), tx('b', 'ready')]),
    );
    const out = await s.run(
      activeRecord({ feeRate: 9, tempBump: { baseFeeRate: 5, txids: ['a'] } }),
    );
    expect(out.tempBump.txids).toEqual(['a', 'b']);
  });

  it('reverts a temporary bump once its steps confirm, before sending more', async () => {
    const s = setup({ utxos: [coin(1)] });
    s.handle.checkExit.mockResolvedValue(
      checked([tx('a', 'confirmed'), tx('b', 'ready')]),
    );
    const out = await s.run(
      activeRecord({ feeRate: 9, tempBump: { baseFeeRate: 5, txids: ['a'] } }),
    );
    expect(s.handle.quoteExit.mock.calls[0][0].feeRate).toBe(5);
    expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-t1']]); // rebuilt, not 'b'
    expect(out.feeRate).toBe(5);
    expect(out.tempBump).toBeNull();
    expect(out.status).toBe('active');
  });

  it('a revert short of funds keeps the active recovery', async () => {
    const s = setup({ utxos: [coin(1, 1000)], quote: rawQuote(5000) });
    shortBuild(s, 5000);
    s.handle.checkExit.mockResolvedValue(checked([tx('a', 'confirmed')]));
    const out = await s.run(
      activeRecord({ feeRate: 9, tempBump: { baseFeeRate: 5, txids: ['a'] } }),
    );
    expect(out.status).toBe('active');
    expect(out.tempBump).toBeNull();
    expect(decodeRecovery(out.recovery).transactions[0].txid).toBe('a');
  });

  it('retries a revert when the fee address cannot be read', async () => {
    const s = setup();
    s.chain.getAddressUtxos.mockRejectedValue(new Error('down'));
    s.handle.checkExit.mockResolvedValue(checked([tx('a', 'confirmed')]));
    const rec = activeRecord({
      feeRate: 9,
      tempBump: { baseFeeRate: 5, txids: ['a'] },
    });
    expect(await s.run(rec)).toBe(rec);
  });

  it('asks for more when a rebuild is short of funds', async () => {
    const s = setup({ utxos: [coin(1, 1000)], quote: rawQuote(1000) });
    s.handle.checkExit.mockResolvedValue(checked([], 'redo'));
    s.handle.buildExit.mockRejectedValue({
      tag: 'InsufficientCpfpFunds',
      inner: { requiredSats: 1500 },
    });
    const out = await s.run(activeRecord());
    expect(out.status).toBe('needsMoreFee');
    expect(out.needMoreSats).toBe(500);
    expect(s.chain.broadcastTx).not.toHaveBeenCalled();
  });

  it('broadcasts every ready step after a long gap', async () => {
    const s = setup({ tip: 4000 });
    s.handle.checkExit.mockResolvedValue(
      checked([tx('a', 'ready'), tx('b', 'ready'), tx('c', 'ready')]),
    );
    const out = await s.run(activeRecord());
    expect(s.chain.broadcastTx).toHaveBeenCalledTimes(3);
    expect(out.tipHeight).toBe(4000);
  });

  describe('an unverified step (H-1)', () => {
    // The SDK built it while the chain was unreadable; a check never clears
    // that, so only a rebuild gets the exit moving again.
    const stuck = () =>
      checked([tx('n1', 'unverified'), tx('r1', 'waitingForDependencies')]);
    const txids = out =>
      decodeRecovery(out.recovery).transactions.map(t => t.txid);

    it('is rebuilt once per block', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockResolvedValue(stuck());
      const out = await s.run(activeRecord());
      expect(s.handle.quoteExit).toHaveBeenCalledWith({
        destination: 'bc1qdest',
        feeRate: 5,
        leafIds: ['L1'],
      });
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-t1']]);
      expect(txids(out)).toEqual(['t1']);
      expect(out.status).toBe('active');
      expect(out.unverifiedRebuiltAt).toBe(1000);
    });

    it('is not rebuilt again in the same block', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockResolvedValue(stuck());
      const out = await s.run(activeRecord({ unverifiedRebuiltAt: 1000 }));
      expect(s.handle.quoteExit).not.toHaveBeenCalled();
      expect(txids(out)).toEqual(['n1', 'r1']);
    });

    it('waits while a step of its own can still be sent', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockResolvedValue(
        checked([tx('n1', 'unverified'), tx('n2', 'ready')]),
      );
      await s.run(activeRecord());
      expect(s.handle.quoteExit).not.toHaveBeenCalled();
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-n2']]);
    });

    it('a co-signed one is sent, not rebuilt', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockResolvedValue(
        checked([tx('c1', 'unverified', { kind: 'cooperative' })]),
      );
      await s.run(activeRecord());
      expect(s.handle.quoteExit).not.toHaveBeenCalled();
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-c1']]);
    });

    it('waits for a known tip', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.chain.getTipHeight.mockRejectedValue(new Error('down'));
      s.handle.checkExit.mockResolvedValue(stuck());
      await s.run(activeRecord());
      expect(s.handle.quoteExit).not.toHaveBeenCalled();
    });

    it('a short rebuild keeps the checked recovery and stays active', async () => {
      const s = setup({ utxos: [coin(1, 1000)], quote: rawQuote(5000) });
      shortBuild(s, 5000);
      s.handle.checkExit.mockResolvedValue(stuck());
      const out = await s.run(activeRecord());
      expect(out.status).toBe('active');
      expect(out.needMoreSats).toBe(0);
      expect(txids(out)).toEqual(['n1', 'r1']);
      expect(out.unverifiedRebuiltAt).toBe(1000);
    });

    it('a failed rebuild keeps the checked recovery', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockResolvedValue(stuck());
      s.handle.buildExit.mockRejectedValue(new Error('chain down'));
      const out = await s.run(activeRecord());
      expect(out.status).toBe('active');
      expect(txids(out)).toEqual(['n1', 'r1']);
      expect(out.unverifiedRebuiltAt).toBe(1000);
    });

    it('an unreadable fee address keeps the checked recovery', async () => {
      const s = setup();
      s.chain.getAddressUtxos.mockRejectedValue(new Error('down'));
      s.handle.checkExit.mockResolvedValue(stuck());
      const out = await s.run(activeRecord());
      expect(txids(out)).toEqual(['n1', 'r1']);
      expect(out.unverifiedRebuiltAt).toBe(1000);
    });
  });

  describe('a build with nothing to send (H-2)', () => {
    it('keeps a new exit cancellable when every co-signed leaf failed', async () => {
      const s = setup({ quote: rawQuote(0) });
      s.handle.buildExit.mockResolvedValue({
        transactions: [],
        failed: [{ leafId: 'L1' }],
      });
      await expect(
        s.run(baseRecord({ quote: { fundingSats: 0 } })),
      ).rejects.toThrow('errCoopUnavailable');
      expect(s.save).not.toHaveBeenCalled();
    });

    it('finishes a new exit whose leaves already landed', async () => {
      const s = setup({ quote: rawQuote(0) });
      s.handle.buildExit.mockResolvedValue({ transactions: [], failed: [] });
      const out = await s.run(baseRecord({ quote: { fundingSats: 0 } }));
      expect(out.status).toBe('done');
      expect(out.recovery).toBeNull();
    });

    it('a rebuild whose co-signs all failed throws and sends nothing', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockResolvedValue(checked([tx('a', 'ready')], 'redo'));
      s.handle.buildExit.mockResolvedValue({
        transactions: [],
        failed: [{ leafId: 'L1' }],
      });
      await expect(s.run(activeRecord())).rejects.toThrow('errCoopUnavailable');
      expect(s.chain.broadcastTx).not.toHaveBeenCalled();
    });
  });

  describe('Insufficient CPFP on web (R-2)', () => {
    it('is a short build, not a failure', async () => {
      const s = setup({ utxos: [coin(1, 5000)], quote: rawQuote(5000) });
      const err = new Error(
        'Insufficient CPFP funding: need at least 9000 sats',
      );
      s.handle.buildExit.mockRejectedValue(err);
      const out = await s.run(baseRecord());
      expect(out.status).toBe('needsMoreFee');
      expect(out.needMoreSats).toBe(4000);
      expect(classifyBreezError(err).kind).toBe('insufficientCpfp');
    });
  });

  describe('exit state and missing leaves (R-4)', () => {
    it('imports the snapshot before quoting, ignoring failures', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockResolvedValue(checked([], 'redo'));
      s.handle.importExitState.mockRejectedValue(new Error('bad'));
      const calls = [];
      s.handle.importExitState.mockImplementation(async () => {
        calls.push('import');
        throw new Error('bad');
      });
      s.handle.quoteExit.mockImplementation(async () => {
        calls.push('quote');
        return rawQuote();
      });
      await s.run(activeRecord({ exitStateSnapshot: 'snap' }));
      expect(s.handle.importExitState).toHaveBeenCalledWith('snap');
      expect(calls).toEqual(['import', 'quote']);
    });

    it('drops a leaf the SDK no longer has and requotes', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockResolvedValue(checked([], 'redo'));
      s.handle.quoteExit
        .mockRejectedValueOnce(
          new Error('Leaf L2 cannot be exited: not found in the tree node map'),
        )
        .mockResolvedValue(rawQuote());
      const out = await s.run(activeRecord({ leafIds: ['L1', 'L2'] }));
      expect(s.handle.quoteExit.mock.calls[1][0].leafIds).toEqual(['L1']);
      expect(out.leafIds).toEqual(['L1']);
      expect(out.failedLeafIds).toContain('L2');
    });

    it('finishes when every named leaf is missing', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockResolvedValue(checked([], 'redo'));
      s.handle.quoteExit.mockImplementation(async ({ leafIds }) => {
        throw new Error(
          `Leaf ${leafIds[0]} cannot be exited: not found in the tree node map`,
        );
      });
      const out = await s.run(activeRecord({ leafIds: ['L1', 'L2'] }));
      expect(out.status).toBe('done');
      expect(out.failedLeafIds).toEqual(['L1', 'L2']);
      expect(s.handle.buildExit).not.toHaveBeenCalled();
    });

    it('a failed hard redo sends nothing and rethrows', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockResolvedValue(checked([tx('a', 'ready')], 'redo'));
      s.handle.buildExit.mockRejectedValue(new Error('boom'));
      await expect(s.run(activeRecord())).rejects.toThrow('boom');
      expect(s.chain.broadcastTx).not.toHaveBeenCalled();
    });
  });

  it('survives the chain tip call failing', async () => {
    const s = setup();
    s.chain.getTipHeight.mockRejectedValue(new Error('down'));
    s.handle.checkExit.mockResolvedValue(checked([tx('a', 'ready')]));
    const out = await s.run(activeRecord());
    expect(out.tipHeight).toBe(100);
    expect(s.chain.broadcastTx).toHaveBeenCalledTimes(1);
  });

  describe('Glow leftover rules', () => {
    const recOf = (txs, leaves, over = {}) =>
      activeRecord({
        leafIds: ['L1', 'L2'],
        recovery: encodeRecovery(built(txs, leaves)),
        ...over,
      });
    const checkedWith = (txs, leaves, type = 'valid') => ({
      recovery: built(txs, leaves),
      verdict: { type },
    });
    const later = (id = 'L2') =>
      quoteOf([], [skip(id, 'operatorsUnavailable')]);
    const txids = out =>
      decodeRecovery(out.recovery).transactions.map(t => t.txid);

    it('retryDue: six blocks, then doubling gaps capped at 144', () => {
      const due = (retrySince, retriedAt, tip) =>
        retryDue({ retrySince, retriedAt }, tip);
      expect(due(undefined, undefined, 999)).toBe(false);
      expect(due(0, undefined, 5)).toBe(false);
      expect(due(0, undefined, 6)).toBe(true);
      expect(due(0, 6, 11)).toBe(false);
      expect(due(0, 6, 12)).toBe(true);
      expect(due(0, 12, 23)).toBe(false);
      expect(due(0, 12, 24)).toBe(true);
      expect(due(0, 200, 343)).toBe(false);
      expect(due(0, 200, 344)).toBe(true);
    });

    it('starts the retry clock on a leftover and stops it when none is left', async () => {
      const s = setup();
      s.handle.checkExit.mockResolvedValue(
        checkedWith([tx('t1', 'confirmed')], ['L1']),
      );
      const out = await s.run(recOf([tx('t1', 'confirmed')], ['L1']));
      expect(out.retrySince).toBe(1000);
      s.handle.checkExit.mockResolvedValue(
        checkedWith([tx('t1', 'confirmed')], ['L1', 'L2']),
      );
      const out2 = await s.run({ ...out, retrySince: 500, retriedAt: 600 });
      expect(out2.retrySince).toBeUndefined();
      expect(out2.retriedAt).toBeUndefined();
    });

    it('does not check a recovery with nothing built', async () => {
      const s = setup();
      const out = await s.run(recOf([], []));
      expect(s.handle.checkExit).not.toHaveBeenCalled();
      expect(out.retrySince).toBe(1000);
    });

    it('a failing check still broadcasts the stored recovery', async () => {
      const s = setup();
      s.handle.checkExit.mockRejectedValue(new Error('chain down'));
      await s.run(activeRecord());
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-t0']]);
    });

    describe('retry', () => {
      const stored = () => [tx('t1', 'confirmed')];
      const coopQuote = () => quoteOf([leaf('L2', 'cooperative')]);
      const fresh = () => ({
        transactions: [coopTx('c-new', 'ready', 'L2')],
        leaves: [leaf('L2', 'cooperative')],
        failed: [],
      });

      it('merges a fresh co-signed tx for a leftover leaf', async () => {
        const s = setup({ quote: coopQuote() });
        s.handle.checkExit.mockResolvedValue(checkedWith(stored(), ['L1']));
        s.handle.buildExit.mockResolvedValue(fresh());
        const out = await s.run(recOf(stored(), ['L1'], { retrySince: 994 }));
        expect(s.handle.quoteExit.mock.calls[0][0].leafIds).toEqual(['L2']);
        expect(s.handle.buildExit.mock.calls[0].slice(1)).toEqual([[], 'sk']);
        expect(txids(out)).toEqual(['t1', 'c-new']);
        expect(decodeRecovery(out.recovery).leaves.map(l => l.leafId)).toEqual([
          'L1',
          'L2',
        ]);
        expect(out.retriedAt).toBe(1000);
        expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-c-new']]);
      });

      it('replaces an unverified co-signed tx', async () => {
        const txs = [
          tx('t1', 'confirmed'),
          coopTx('c-old', 'unverified', 'L2'),
        ];
        const s = setup({ quote: coopQuote() });
        s.handle.checkExit.mockResolvedValue(checkedWith(txs, ['L1', 'L2']));
        s.handle.buildExit.mockResolvedValue(fresh());
        const out = await s.run(recOf(txs, ['L1', 'L2'], { retrySince: 994 }));
        expect(txids(out)).toEqual(['t1', 'c-new']);
      });

      it('an empty co-signed build changes nothing', async () => {
        const s = setup({ quote: coopQuote() });
        s.handle.checkExit.mockResolvedValue(checkedWith(stored(), ['L1']));
        s.handle.buildExit.mockResolvedValue({
          transactions: [],
          failed: [{ leafId: 'L2' }],
        });
        const out = await s.run(recOf(stored(), ['L1'], { retrySince: 994 }));
        expect(txids(out)).toEqual(['t1']);
        expect(out.leafIds).toEqual(['L1', 'L2']);
        expect(out.retriedAt).toBe(1000);
      });

      it('an error inside the retry never fails the pass', async () => {
        const s = setup({ quote: coopQuote() });
        s.handle.checkExit.mockResolvedValue(checkedWith(stored(), ['L1']));
        s.handle.buildExit.mockRejectedValue(new Error('boom'));
        const out = await s.run(recOf(stored(), ['L1'], { retrySince: 994 }));
        expect(out.retriedAt).toBe(1000);
        expect(out.status).toBe('active');
      });

      it('a target the quote lists nowhere has landed and leaves leafIds', async () => {
        const s = setup({ quote: quoteOf([]) });
        s.handle.checkExit.mockResolvedValue(checkedWith(stored(), ['L1']));
        const out = await s.run(recOf(stored(), ['L1'], { retrySince: 994 }));
        expect(out.leafIds).toEqual(['L1']);
        expect(out.status).toBe('active');
      });

      it('is not run before it is due', async () => {
        const s = setup({ quote: later() });
        s.handle.checkExit.mockResolvedValue(checkedWith(stored(), ['L1']));
        await s.run(recOf(stored(), ['L1'], { retrySince: 998 }));
        expect(s.handle.quoteExit).not.toHaveBeenCalled();
      });

      it('a unilateral leftover after the rest landed is a full rebuild', async () => {
        const s = setup({ utxos: [coin(1)], quote: quoteOf([leaf('L2')]) });
        s.handle.checkExit.mockResolvedValue(checkedWith(stored(), ['L1']));
        const out = await s.run(recOf(stored(), ['L1'], { retrySince: 994 }));
        expect(s.handle.quoteExit.mock.calls.map(c => c[0].leafIds)).toEqual([
          ['L2'],
          ['L1', 'L2'],
        ]);
        expect(s.handle.buildExit).toHaveBeenCalled();
        expect(out.status).toBe('active');
      });
    });

    describe('release', () => {
      it('lets leftovers go after 1008 blocks once the unilateral steps landed', async () => {
        const s = setup({ quote: later() });
        s.handle.checkExit.mockResolvedValue(
          checkedWith([tx('t1', 'confirmed')], ['L1']),
        );
        const out = await s.run(
          recOf([tx('t1', 'confirmed')], ['L1'], { retrySince: 1000 - 1008 }),
        );
        expect(out.leafIds).toEqual(['L1']);
        expect(out.releasedLeafIds).toEqual(['L2']);
        expect(out.failedLeafIds).toEqual(['L2']);
        expect(out.retrySince).toBeUndefined();
        expect(s.handle.quoteExit).not.toHaveBeenCalled();
      });

      it('waits while a unilateral step is unconfirmed', async () => {
        const s = setup({ quote: later() });
        s.handle.checkExit.mockResolvedValue(
          checkedWith([tx('t1', 'ready')], ['L1']),
        );
        const out = await s.run(
          recOf([tx('t1', 'ready')], ['L1'], { retrySince: 1000 - 1008 }),
        );
        expect(out.releasedLeafIds).toBeUndefined();
        expect(out.leafIds).toEqual(['L1', 'L2']);
      });

      it('finishes when releasing leaves nothing built or named', async () => {
        const s = setup();
        s.handle.checkExit.mockResolvedValue(checkedWith([], []));
        const out = await s.run(
          recOf([], [], { leafIds: ['L2'], retrySince: 1000 - 1008 }),
        );
        expect(out.status).toBe('done');
        expect(out.releasedLeafIds).toEqual(['L2']);
      });
    });

    describe('Done verdict with leftovers', () => {
      it('keeps running and retries at once', async () => {
        const s = setup({ quote: later() });
        s.handle.checkExit.mockResolvedValue(
          checkedWith([tx('t1', 'confirmed')], ['L1'], 'done'),
        );
        const out = await s.run(recOf([tx('t1', 'confirmed')], ['L1']));
        expect(out.status).toBe('active');
        expect(s.handle.quoteExit.mock.calls[0][0].leafIds).toEqual(['L2']);
      });

      it('finishes once the leftover landed and nothing is left', async () => {
        const s = setup({ quote: quoteOf([]) });
        s.handle.checkExit.mockResolvedValue(
          checkedWith([tx('t1', 'confirmed')], ['L1'], 'done'),
        );
        const out = await s.run(recOf([tx('t1', 'confirmed')], ['L1']));
        expect(out.status).toBe('done');
        expect(out.leafIds).toEqual(['L1']);
      });

      it('with no leftovers is done as before', async () => {
        const s = setup();
        s.handle.checkExit.mockResolvedValue(
          checkedWith([tx('t1', 'confirmed')], ['L1', 'L2'], 'done'),
        );
        const out = await s.run(recOf([tx('t1', 'confirmed')], ['L1', 'L2']));
        expect(out.status).toBe('done');
      });
    });

    it('the pass that lands the last unilateral step retries at once', async () => {
      const s = setup({ quote: later() });
      s.handle.checkExit.mockResolvedValue(
        checkedWith([tx('t1', 'confirmed')], ['L1']),
      );
      const out = await s.run(recOf([tx('t1', 'ready')], ['L1']));
      expect(out.retrySince).toBe(1000);
      expect(out.retriedAt).toBe(1000);
      expect(s.handle.quoteExit.mock.calls[0][0].leafIds).toEqual(['L2']);
    });

    describe('hard rebuild (redo)', () => {
      const redo = s =>
        s.handle.checkExit.mockResolvedValue(
          checked([tx('a', 'ready')], 'redo'),
        );

      it.each(['operatorsUnavailable', 'fundsNotFound', 'unverified'])(
        'only a provisional skip (%s) waits: nothing sent, no throw, still active',
        async reason => {
          const s = setup({
            utxos: [coin(1)],
            quote: quoteOf([], [skip('L1', reason)]),
          });
          redo(s);
          const out = await s.run(activeRecord());
          expect(out.status).toBe('active');
          expect(out.recovery).toBe(
            encodeRecovery(checked([tx('a', 'ready')]).recovery),
          );
          expect(s.chain.broadcastTx).not.toHaveBeenCalled();
          expect(s.handle.buildExit).not.toHaveBeenCalled();
        },
      );

      it('a stopped notRecoverable leaf is provisional for 6 blocks, then leaves', async () => {
        const quote = quoteOf([], [skip('L1', 'notRecoverable')], {
          exitChainState: { stoppedLeafIds: ['L1'] },
        });
        const s = setup({ utxos: [coin(1)], quote });
        redo(s);
        const first = await s.run(activeRecord());
        expect(first.status).toBe('active');
        expect(first.stoppedSince).toEqual({ L1: 1000 });
        const second = await s.run(activeRecord({ stoppedSince: { L1: 994 } }));
        expect(second.status).toBe('done');
        expect(second.droppedLeafIds).toEqual(['L1']);
        expect(second.failedLeafIds).toEqual(['L1']);
      });

      it('feeExceedsValue leaves the exit without being dropped', async () => {
        const s = setup({
          utxos: [coin(1)],
          quote: quoteOf([], [skip('L1', 'feeExceedsValue')]),
        });
        redo(s);
        const out = await s.run(activeRecord());
        expect(out.status).toBe('done');
        expect(out.leafIds).toEqual([]);
        expect(out.droppedLeafIds ?? []).toEqual([]);
      });
    });

    it('a first build keeps provisional-skipped leaves named as leftovers', async () => {
      const s = setup({
        utxos: [coin(1), coin(2)],
        quote: quoteOf([leaf('L1')], [skip('L2', 'operatorsUnavailable')], {
          funding: { singleUtxoSats: 5000 },
        }),
      });
      const out = await s.run(baseRecord({ leafIds: ['L1', 'L2'] }));
      expect(out.leafIds).toEqual(['L1', 'L2']);
      expect(out.failedLeafIds).toEqual(['L2']);
    });

    it('a first build with only provisional skips stays cancellable', async () => {
      const s = setup({
        quote: quoteOf([], [skip('L1', 'unverified')]),
      });
      await expect(
        s.run(baseRecord({ quote: { fundingSats: 0 } })),
      ).rejects.toThrow('errCoopUnavailable');
      expect(s.save).not.toHaveBeenCalled();
    });

    describe('isStalled', () => {
      const stalledRec = (txs, over = {}) => ({
        status: 'active',
        leafIds: ['L1'],
        recovery: encodeRecovery(built(txs)),
        ...over,
      });
      it('is true when only stuck co-signed steps remain', () => {
        const txs = [tx('a', 'confirmed'), coopTx('c', 'unverified', 'L1')];
        expect(isStalled(stalledRec(txs), false)).toBe(true);
      });
      it('is false while a step can still move', () => {
        const txs = [tx('a', 'ready'), coopTx('c', 'unverified', 'L1')];
        expect(isStalled(stalledRec(txs), false)).toBe(false);
      });
      it('is true with everything confirmed and a leftover', () => {
        expect(
          isStalled(
            stalledRec([tx('a', 'confirmed')], { leafIds: ['L1', 'L2'] }),
            false,
          ),
        ).toBe(true);
      });
      it('is false with everything confirmed and nothing left', () => {
        expect(isStalled(stalledRec([tx('a', 'confirmed')]), false)).toBe(
          false,
        );
      });
    });
  });

  describe('a live recovery waiting on more fee (R-5)', () => {
    const waiting = (over = {}) =>
      activeRecord({
        status: 'needsMoreFee',
        needMoreSats: 500,
        quote: { fundingSats: 5000 },
        ...over,
      });

    it('checks and broadcasts it even with no coins', async () => {
      const s = setup();
      s.handle.checkExit.mockResolvedValue(
        checked([tx('a', 'ready'), tx('b', 'waitingForTimelock')]),
      );
      const out = await s.run(waiting({ fundingInputs: [] }));
      expect(s.handle.checkExit).toHaveBeenCalled();
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-a']]);
      expect(out.status).toBe('needsMoreFee');
      expect(decodeRecovery(out.recovery).transactions[0].txid).toBe('a');
      expect(s.order.indexOf('save:recovery')).toBeLessThan(
        s.order.indexOf('tx'),
      );
    });

    it('a redo verdict broadcasts nothing', async () => {
      const s = setup();
      s.handle.checkExit.mockResolvedValue(checked([tx('a', 'ready')], 'redo'));
      await s.run(waiting({ fundingInputs: [] }));
      expect(s.chain.broadcastTx).not.toHaveBeenCalled();
    });

    it('a failing check broadcasts the stored recovery', async () => {
      const s = setup();
      s.handle.checkExit.mockRejectedValue(new Error('down'));
      await s.run(waiting({ fundingInputs: [] }));
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-t0']]);
    });

    it('a done verdict finishes it', async () => {
      const s = setup();
      s.handle.checkExit.mockResolvedValue(
        checked([tx('a', 'confirmed')], 'done'),
      );
      const out = await s.run(waiting());
      expect(out.status).toBe('done');
      expect(s.chain.broadcastTx).not.toHaveBeenCalled();
    });

    it('a short rebuild keeps needsMoreFee and the checked recovery', async () => {
      const s = setup({ utxos: [coin(1, 1000)], quote: rawQuote(5000) });
      s.handle.checkExit.mockResolvedValue(checked([tx('a', 'ready')]));
      shortBuild(s, 5000);
      const out = await s.run(waiting());
      expect(out.status).toBe('needsMoreFee');
      expect(decodeRecovery(out.recovery).transactions[0].txid).toBe('a');
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-a']]);
    });

    it('a successful build replaces the recovery', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockResolvedValue(checked([tx('a', 'ready')]));
      const out = await s.run(waiting());
      expect(out.status).toBe('active');
      expect(decodeRecovery(out.recovery).transactions[0].txid).toBe('t1');
    });
  });

  // Failure modes (MED-1): any "Leaf X cannot be exited: <reason>" for a named
  // leaf must drop only that leaf; one naming a leaf we never asked for must
  // still rethrow.
  describe('a leaf that cannot be exited for any reason (MED-1)', () => {
    it.each([
      'incomplete ancestor chain (parent P missing from the tree map)',
      'no refund transaction',
    ])('drops just that leaf: %s', async reason => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockResolvedValue(checked([], 'redo'));
      s.handle.quoteExit
        .mockRejectedValueOnce(
          new Error(`Invalid input: Leaf L2 cannot be exited: ${reason}`),
        )
        .mockResolvedValue(rawQuote());
      const out = await s.run(activeRecord({ leafIds: ['L1', 'L2'] }));
      expect(s.handle.quoteExit.mock.calls[1][0].leafIds).toEqual(['L1']);
      expect(out.droppedLeafIds).toContain('L2');
      expect(s.handle.buildExit).toHaveBeenCalled();
    });

    it('rethrows for a leaf the exit never named', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockResolvedValue(checked([], 'redo'));
      s.handle.quoteExit.mockRejectedValue(
        new Error('Leaf Z cannot be exited: no refund transaction'),
      );
      await expect(s.run(activeRecord())).rejects.toThrow('Leaf Z');
    });
  });

  // Failure modes (H-1): a checkExit that throws must not freeze the exit.
  // - InvalidInput / TypeError (unreadable stored recovery): rebuild at once
  // - other errors: broadcast stored, remember since when, rebuild after 2 blocks
  // - failed rebuild: stored steps still go out, error surfaced
  // - short rebuild: needsMoreFee, stored recovery kept
  // - one rebuild per block
  // - awaitingFee/needsMoreFee with a dead check still builds
  describe('a check that cannot read the recovery', () => {
    const unreadable = () =>
      Object.assign(new Error('Invalid input: bad recovery'), {
        tag: 'InvalidInput',
      });

    it('rebuilds from the stored leaves and funding on invalid input', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockRejectedValue(unreadable());
      const out = await s.run(
        activeRecord({
          checkFailingSince: 990,
          checkError: 'old',
          leafIds: ['L1'],
        }),
      );
      expect(s.handle.quoteExit.mock.calls[0][0].leafIds).toEqual(['L1']);
      expect(s.handle.buildExit.mock.calls[0][1]).toEqual([input(coin(1))]);
      expect(decodeRecovery(out.recovery).transactions[0].txid).toBe('t1');
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-t1']]);
      expect(out.checkFailingSince).toBeUndefined();
      expect(out.checkError).toBeUndefined();
    });

    it('rebuilds on a native TypeError', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockRejectedValue(new TypeError('undefined is not'));
      await s.run(activeRecord());
      expect(s.handle.quoteExit).toHaveBeenCalled();
    });

    it('other errors broadcast the stored steps, then rebuild two blocks later', async () => {
      const s = setup({ utxos: [coin(1)], tip: 1000 });
      s.handle.checkExit.mockRejectedValue(new Error('boom'));
      const out = await s.run(activeRecord());
      expect(s.handle.quoteExit).not.toHaveBeenCalled();
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-t0']]);
      expect(out.checkFailingSince).toBe(1000);

      const s2 = setup({ utxos: [coin(1)], tip: 1002 });
      s2.handle.checkExit.mockRejectedValue(new Error('boom'));
      const out2 = await s2.run(activeRecord({ checkFailingSince: 1000 }));
      expect(s2.handle.quoteExit).toHaveBeenCalled();
      expect(decodeRecovery(out2.recovery).transactions[0].txid).toBe('t1');
    });

    it('a failing rebuild still broadcasts the stored steps and surfaces the error', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockRejectedValue(unreadable());
      s.handle.quoteExit.mockRejectedValue(new Error('quote down'));
      const out = await s.run(activeRecord());
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-t0']]);
      expect(out.status).toBe('active');
      expect(out.checkError).toMatch('bad recovery');
    });

    it('a rebuild short of funds keeps the stored recovery', async () => {
      const s = setup({ utxos: [coin(1, 1000)], quote: rawQuote(5000) });
      s.handle.checkExit.mockRejectedValue(unreadable());
      shortBuild(s, 5000);
      const out = await s.run(activeRecord());
      expect(out.status).toBe('needsMoreFee');
      expect(decodeRecovery(out.recovery).transactions[0].txid).toBe('t0');
      expect(s.chain.broadcastTx.mock.calls).toEqual([['hex-t0']]);
    });

    it('does not quote again in the same block', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockRejectedValue(unreadable());
      s.handle.quoteExit.mockRejectedValue(new Error('quote down'));
      const first = await s.run(activeRecord());
      s.handle.quoteExit.mockClear();
      await s.run(first);
      expect(s.handle.quoteExit).not.toHaveBeenCalled();
      expect(s.chain.broadcastTx).toHaveBeenCalled();
    });

    it('a waiting recovery whose check fails still broadcasts and builds', async () => {
      const s = setup({ utxos: [coin(1)] });
      s.handle.checkExit.mockRejectedValue(unreadable());
      const out = await s.run(
        activeRecord({ status: 'needsMoreFee', needMoreSats: 500 }),
      );
      expect(s.chain.broadcastTx.mock.calls[0]).toEqual(['hex-t0']);
      expect(s.handle.buildExit).toHaveBeenCalled();
      expect(out.status).toBe('active');
    });
  });
});
