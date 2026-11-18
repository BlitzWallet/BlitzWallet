import {
  getTipHeight,
  getAddressUtxos,
  broadcastTx,
  broadcastPackage,
  isAlreadyKnown,
} from '../../../app/functions/unilateralExit/exitChain';

const ok = body => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});
const bad = (text, status = 400) => ({
  ok: false,
  status,
  json: async () => {
    throw new Error('not json');
  },
  text: async () => text,
});

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('exitChain', () => {
  it('falls back to blockstream when mempool.space fails a read', async () => {
    global.fetch
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(ok(850000));
    await expect(getTipHeight()).resolves.toBe(850000);
    expect(global.fetch.mock.calls[0][0]).toBe(
      'https://mempool.space/api/blocks/tip/height',
    );
    expect(global.fetch.mock.calls[1][0]).toBe(
      'https://blockstream.info/api/blocks/tip/height',
    );
  });

  it('maps address utxos', async () => {
    global.fetch.mockResolvedValueOnce(
      ok([{ txid: 'aa', vout: 1, value: 500, status: { confirmed: true } }]),
    );
    await expect(getAddressUtxos('bc1qx')).resolves.toEqual([
      { txid: 'aa', vout: 1, valueSats: 500, confirmed: true },
    ]);
  });

  it('treats an already-in-mempool rejection as success', async () => {
    global.fetch.mockResolvedValueOnce(
      bad('sendrawtransaction RPC error: txn-already-in-mempool'),
    );
    await expect(broadcastTx('00')).resolves.toBeUndefined();
    expect(isAlreadyKnown('Transaction already in block chain')).toBe(true);
    expect(isAlreadyKnown('bad-txns-inputs-missingorspent')).toBe(false);
  });

  it('broadcastTx falls back, then throws the last body text', async () => {
    global.fetch
      .mockResolvedValueOnce(bad('first'))
      .mockResolvedValueOnce(bad('second'));
    await expect(broadcastTx('00')).rejects.toThrow('second');
  });

  it('package: package_msg success resolves', async () => {
    global.fetch.mockResolvedValueOnce(ok({ package_msg: 'success' }));
    await expect(broadcastPackage('aa', 'bb')).resolves.toBeUndefined();
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://mempool.space/api/v1/txs/package');
    expect(JSON.parse(opts.body)).toEqual(['aa', 'bb']);
  });

  it('package: tx-results error rejects with that error', async () => {
    global.fetch.mockResolvedValueOnce(
      ok({
        package_msg: 'transaction failed',
        'tx-results': { w1: { txid: 'a', error: 'min relay fee not met' } },
      }),
    );
    await expect(broadcastPackage('aa', 'bb')).rejects.toThrow(
      'min relay fee not met',
    );
  });

  it('package: already-known in tx-results resolves', async () => {
    global.fetch.mockResolvedValueOnce(
      ok({
        package_msg: 'transaction failed',
        'tx-results': {
          w1: { txid: 'a', error: 'txn-already-in-mempool' },
          w2: { txid: 'b' },
        },
      }),
    );
    await expect(broadcastPackage('aa', 'bb')).resolves.toBeUndefined();
  });

  it('times out a hanging request', async () => {
    jest.useFakeTimers();
    global.fetch.mockImplementation(
      (url, { signal }) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    const p = broadcastPackage('aa', 'bb');
    const assertion = expect(p).rejects.toThrow();
    await jest.advanceTimersByTimeAsync(10000);
    await assertion;
    jest.useRealTimers();
  });
});
