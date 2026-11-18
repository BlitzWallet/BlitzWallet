import {
  startExitEngine,
  stopExitEngine,
  startExit,
  startRecovery,
  quoteRecovery,
  cancelExit,
  bumpExitFee,
  getExitSnapshot,
} from '../../../app/functions/unilateralExit/exitEngine';

const mockApp = { currentState: 'active', listeners: [] };
// Engine errors are translated at throw time (same pattern as sendIntents).
jest.mock('i18next', () => ({ __esModule: true, default: { t: k => k } }));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: {
    get currentState() {
      return mockApp.currentState;
    },
    addEventListener: jest.fn((_, fn) => {
      mockApp.listeners.push(fn);
      return { remove: jest.fn() };
    }),
  },
}));
jest.mock('../../../app/functions/unilateralExit/exitPass', () => ({
  runExitPass: jest.fn(),
  isStalled: jest.fn(() => false),
}));
jest.mock('../../../app/functions/unilateralExit/exitStore', () => ({
  loadExitRecord: jest.fn(),
  saveExitRecord: jest.fn(async (_, r) => r),
  archiveExitRecord: jest.fn(async () => {}),
  listKeptRecoveries: jest.fn(async () => []),
  saveKeptRecovery: jest.fn(async (_, r) => r),
  archiveKeptRecovery: jest.fn(async () => {}),
}));
jest.mock('../../../app/functions/unilateralExit/exitFeeKey', () => ({
  deriveExitFeeKey: () => ({
    address: 'bc1qfee',
    publicKeyHex: '02',
    secretKey: 's',
  }),
}));
jest.mock('../../../app/functions/unilateralExit/exitChain', () => ({}));
jest.mock('../../../app/functions/unilateralExit/exitReminders', () => ({
  syncExitReminders: jest.fn(async () => {}),
  clearExitReminders: jest.fn(async () => {}),
  ensureReminderPermission: jest.fn(async () => true),
}));
const mockHandle = {
  exportExitState: jest.fn(async () => 'SNAP'),
  quoteExit: jest.fn(),
  buildExit: jest.fn(),
};
jest.mock('../../../app/functions/spark', () => ({
  getExitHandle: jest.fn(async () => mockHandle),
}));
jest.mock('../../../app/functions/spark/walletRuntime', () => ({
  identityFor: jest.fn(async () => 'id'),
  acquire: jest.fn(async () => mockHandle),
  release: jest.fn(async () => {}),
}));

const {
  runExitPass,
  isStalled,
} = require('../../../app/functions/unilateralExit/exitPass');
const store = require('../../../app/functions/unilateralExit/exitStore');
const walletRuntime = require('../../../app/functions/spark/walletRuntime');

const rec = (over = {}) => ({
  v: 1,
  identity: 'id',
  status: 'active',
  quote: { fundingSats: 0 },
  recovery: null,
  tipHeight: 100,
  refusals: {},
  failedLeafIds: [],
  ...over,
});
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

beforeEach(async () => {
  stopExitEngine();
  jest.useFakeTimers();
  jest.clearAllMocks();
  isStalled.mockReturnValue(false);
  store.listKeptRecoveries.mockResolvedValue([]);
  mockApp.currentState = 'active';
  store.loadExitRecord.mockResolvedValue({ record: null, corrupt: false });
  runExitPass.mockImplementation(async ({ record }) => record);
});
afterEach(() => {
  stopExitEngine();
  jest.useRealTimers();
});

describe('exitEngine', () => {
  it('does not start without a mnemonic', async () => {
    await startExitEngine('');
    expect(store.loadExitRecord).not.toHaveBeenCalled();
  });

  it('runs one pass at a time', async () => {
    store.loadExitRecord.mockResolvedValue({ record: rec(), corrupt: false });
    let release;
    runExitPass.mockImplementation(
      ({ record }) => new Promise(r => (release = () => r(record))),
    );
    await startExitEngine('m');
    await flush();
    expect(runExitPass).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(30000);
    jest.advanceTimersByTime(30000);
    await flush();
    expect(runExitPass).toHaveBeenCalledTimes(1);
    release();
    await flush();
    expect(runExitPass).toHaveBeenCalledTimes(2); // coalesced into one more
    release();
    await flush();
    expect(runExitPass).toHaveBeenCalledTimes(2);
  });

  it('polls every 30 s only while active', async () => {
    store.loadExitRecord.mockResolvedValue({ record: rec(), corrupt: false });
    await startExitEngine('m');
    await flush();
    runExitPass.mockClear();
    jest.advanceTimersByTime(30000);
    await flush();
    expect(runExitPass).toHaveBeenCalledTimes(1);
    mockApp.currentState = 'background';
    jest.advanceTimersByTime(60000);
    await flush();
    expect(runExitPass).toHaveBeenCalledTimes(1);
  });

  it('polls a stalled exit only every 20th tick, but resumes at once', async () => {
    store.loadExitRecord.mockResolvedValue({ record: rec(), corrupt: false });
    await startExitEngine('m');
    await flush();
    isStalled.mockReturnValue(true);
    runExitPass.mockClear();
    for (let i = 0; i < 19; i++) jest.advanceTimersByTime(30000);
    await flush();
    expect(runExitPass).not.toHaveBeenCalled();
    jest.advanceTimersByTime(30000);
    await flush();
    expect(runExitPass).toHaveBeenCalledTimes(1);
    runExitPass.mockClear();
    mockApp.listeners.at(-1)('active');
    await flush();
    expect(runExitPass).toHaveBeenCalledTimes(1);
    isStalled.mockReturnValue(false);
  });

  it('cancel refuses once active', async () => {
    store.loadExitRecord.mockResolvedValue({ record: rec(), corrupt: false });
    await startExitEngine('m');
    await flush();
    await expect(cancelExit('m')).rejects.toThrow();
  });

  it('cancel refuses while a recovery exists', async () => {
    store.loadExitRecord.mockResolvedValue({
      record: rec({
        status: 'needsMoreFee',
        recovery: '{"transactions":[],"failed":[]}',
      }),
      corrupt: false,
    });
    await startExitEngine('m');
    await flush();
    await expect(cancelExit('m')).rejects.toThrow();
  });

  it('cancels an awaitingFee record', async () => {
    store.loadExitRecord.mockResolvedValue({
      record: rec({ status: 'awaitingFee' }),
      corrupt: false,
    });
    await startExitEngine('m');
    await flush();
    await cancelExit('m');
    expect(store.archiveExitRecord).toHaveBeenCalledWith('id');
    expect(getExitSnapshot().record).toBeNull();
  });

  it('cancel refuses while a pass is running', async () => {
    store.loadExitRecord.mockResolvedValue({
      record: rec({ status: 'awaitingFee' }),
      corrupt: false,
    });
    runExitPass.mockImplementation(() => new Promise(() => {}));
    await startExitEngine('m');
    await flush();
    // Translated at throw time; i18next is uninitialized here, so the key is the message.
    await expect(cancelExit('m')).rejects.toThrow('errBusy');
    expect(store.archiveExitRecord).not.toHaveBeenCalled();
  });

  it('a pass started during cancel does not recreate the record', async () => {
    store.loadExitRecord.mockResolvedValue({
      record: rec({ status: 'awaitingFee' }),
      corrupt: false,
    });
    await startExitEngine('m');
    await flush();
    runExitPass.mockClear();
    let finish;
    store.archiveExitRecord.mockImplementation(
      () => new Promise(r => (finish = r)),
    );
    const p = cancelExit('m');
    await flush();
    expect(getExitSnapshot().record).toBeNull();
    jest.advanceTimersByTime(60000);
    await flush();
    expect(runExitPass).not.toHaveBeenCalled();
    finish();
    await p;
    store.archiveExitRecord.mockImplementation(async () => {});
  });

  it('bump refuses while a pass is running', async () => {
    store.loadExitRecord.mockResolvedValue({ record: rec(), corrupt: false });
    runExitPass.mockImplementation(() => new Promise(() => {}));
    await startExitEngine('m');
    await flush();
    await expect(bumpExitFee('m', 9)).rejects.toThrow('errBusy');
  });

  describe('temporary bump', () => {
    const {
      encodeRecovery,
    } = require('../../../app/functions/unilateralExit/exitCodec');
    const withSteps = over =>
      rec({
        feeRate: 5,
        recovery: encodeRecovery({
          transactions: [
            {
              txid: 'a',
              kind: 'node',
              dependsOn: [],
              status: { type: 'ready' },
            },
            {
              txid: 'b',
              kind: 'node',
              dependsOn: [],
              status: { type: 'waitingForDependencies' },
            },
          ],
          failed: [],
        }),
        ...over,
      });
    const start = async record => {
      store.loadExitRecord.mockResolvedValue({ record, corrupt: false });
      await startExitEngine('m');
      await flush();
    };

    it('records the base rate and the steps waiting to confirm', async () => {
      await start(withSteps());
      await bumpExitFee('m', 9, { temporary: true });
      const saved = store.saveExitRecord.mock.calls.at(-1)[1];
      expect(saved.feeRate).toBe(9);
      expect(saved.bumpRequested).toBe(true);
      expect(saved.tempBump).toEqual({ baseFeeRate: 5, txids: ['a'] });
    });

    it('a second temporary bump keeps the original base rate', async () => {
      await start(
        withSteps({ feeRate: 9, tempBump: { baseFeeRate: 5, txids: ['x'] } }),
      );
      await bumpExitFee('m', 12, { temporary: true });
      const saved = store.saveExitRecord.mock.calls.at(-1)[1];
      expect(saved.tempBump).toEqual({ baseFeeRate: 5, txids: ['x', 'a'] });
    });

    it('stores bumpFrom, and a second bump keeps the first', async () => {
      await start(withSteps());
      await bumpExitFee('m', 9);
      expect(store.saveExitRecord.mock.calls.at(-1)[1].bumpFrom).toEqual({
        feeRate: 5,
        tempBump: null,
      });
      await start(
        withSteps({
          feeRate: 9,
          bumpFrom: { feeRate: 5, tempBump: null },
          bumpRequested: true,
        }),
      );
      await bumpExitFee('m', 12);
      expect(store.saveExitRecord.mock.calls.at(-1)[1].bumpFrom).toEqual({
        feeRate: 5,
        tempBump: null,
      });
    });

    it('a permanent bump drops any temporary one', async () => {
      await start(
        withSteps({ feeRate: 9, tempBump: { baseFeeRate: 5, txids: ['a'] } }),
      );
      await bumpExitFee('m', 12);
      expect(store.saveExitRecord.mock.calls.at(-1)[1].tempBump).toBeNull();
    });
  });

  it('startExit does not dispose the wallet identity', async () => {
    await startExit({
      mnemonic: 'm',
      destination: 'd',
      feeRate: 1,
      quote: { leafIds: [] },
    });
    expect(walletRuntime.release).not.toHaveBeenCalled();
  });

  it('startExit stores a snapshot of the exit data', async () => {
    const quote = {
      receiveSats: 9,
      totalFeeSats: 1,
      fundingSats: 5,
      recoverableSats: 10,
      leafIds: ['L'],
    };
    await startExit({ mnemonic: 'm', destination: 'bc1q', feeRate: 3, quote });
    const saved = store.saveExitRecord.mock.calls[0][1];
    expect(saved.exitStateSnapshot).toBe('SNAP');
    expect(saved.status).toBe('awaitingFee');
    expect(saved.leafIds).toEqual(['L']);
    expect(walletRuntime.acquire).toHaveBeenCalledWith('m', { mode: 'client' });
  });

  it('archives and stops on done', async () => {
    store.loadExitRecord.mockResolvedValue({ record: rec(), corrupt: false });
    runExitPass.mockImplementation(async ({ record }) => ({
      ...record,
      status: 'done',
    }));
    await startExitEngine('m');
    await flush();
    expect(store.archiveExitRecord).toHaveBeenCalledWith('id');
    expect(getExitSnapshot().record.status).toBe('done');
    runExitPass.mockClear();
    jest.advanceTimersByTime(60000);
    await flush();
    expect(runExitPass).not.toHaveBeenCalled();
  });

  it('startExit refuses while the engine is still loading an existing record', async () => {
    let resolve;
    store.loadExitRecord.mockImplementation(
      () => new Promise(r => (resolve = r)),
    );
    const quote = { leafIds: [] };
    const p = startExit({ mnemonic: 'm', destination: 'd', feeRate: 1, quote });
    const outcome = p.then(
      () => 'ok',
      () => 'refused',
    );
    await flush();
    resolve({ record: rec(), corrupt: false });
    expect(await outcome).toBe('refused');
    expect(store.saveExitRecord).not.toHaveBeenCalled();
  });

  it('startExit allows a new exit over a done record', async () => {
    store.loadExitRecord.mockResolvedValue({
      record: rec({ status: 'done' }),
      corrupt: false,
    });
    await startExit({
      mnemonic: 'm',
      destination: 'd',
      feeRate: 1,
      quote: { leafIds: [] },
    });
    expect(store.saveExitRecord).toHaveBeenCalled();
  });

  it('archives a loaded done record', async () => {
    store.loadExitRecord.mockResolvedValue({
      record: rec({ status: 'done' }),
      corrupt: false,
    });
    await startExitEngine('m');
    expect(store.archiveExitRecord).toHaveBeenCalledWith('id');
    expect(getExitSnapshot().record.status).toBe('done');
  });

  describe('kept recoveries', () => {
    const keptRec = (over = {}) => ({
      v: 1,
      id: 'k1',
      mode: 'recover',
      status: 'active',
      recovery: null,
      ...over,
    });
    const coop = id => ({ leafId: id, method: 0 });
    const uni = id => ({ leafId: id, method: 1 });
    const rawOf = (leaves, extra = {}) => ({
      recoverableValueSats: 100000,
      totalFeeSats: 100,
      cooperativeFeeSats: 0,
      refundFeeSats: 0,
      sweepFeeSats: 0,
      leaves,
      skipped: [],
      ...extra,
    });
    const builtOf = (txid, ids) => ({
      transactions: [{ txid }],
      leaves: ids.map(leafId => ({ leafId })),
      failed: [],
    });

    it('advances kept recoveries each pass and archives the done ones', async () => {
      store.listKeptRecoveries.mockResolvedValue([keptRec()]);
      runExitPass.mockImplementation(async ({ record }) =>
        record.id === 'k1' ? { ...record, status: 'done' } : record,
      );
      await startExitEngine('m');
      await flush();
      expect(runExitPass.mock.calls[0][0].record.id).toBe('k1');
      expect(store.archiveKeptRecovery).toHaveBeenCalledWith('id', 'k1');
      expect(getExitSnapshot().recoveries).toEqual([]);
    });

    it('a throwing kept pass does not break the main pass', async () => {
      store.loadExitRecord.mockResolvedValue({ record: rec(), corrupt: false });
      store.listKeptRecoveries.mockResolvedValue([keptRec()]);
      runExitPass.mockImplementation(async ({ record }) => {
        if (record.id === 'k1') throw new Error('kept boom');
        return { ...record, tipHeight: 555 };
      });
      await startExitEngine('m');
      await flush();
      const snap = getExitSnapshot();
      expect(snap.record.tipHeight).toBe(555);
      expect(snap.lastError).toBeNull();
      expect(snap.recoveries).toHaveLength(1);
    });

    it('startRecovery with no funding keeps the recovery beside the exit', async () => {
      mockHandle.buildExit.mockResolvedValue(builtOf('tx1', ['A']));
      const raw = rawOf([coop('A')]);
      const out = await startRecovery({
        mnemonic: 'm',
        destination: 'bc1q',
        feeRate: 3,
        raw,
      });
      expect(out).toEqual({ kept: true });
      expect(mockHandle.buildExit).toHaveBeenCalledWith(raw, [], 's');
      const saved = store.saveKeptRecovery.mock.calls[0][1];
      expect(saved).toMatchObject({
        id: 'tx1',
        mode: 'recover',
        status: 'active',
        leafIds: ['A'],
        fundingInputs: [],
      });
      expect(getExitSnapshot().recoveries).toHaveLength(1);
    });

    it('startRecovery refuses an empty build', async () => {
      mockHandle.buildExit.mockResolvedValue({
        transactions: [],
        leaves: [],
        failed: [],
      });
      await expect(
        startRecovery({
          mnemonic: 'm',
          destination: 'bc1q',
          feeRate: 3,
          raw: rawOf([coop('A')]),
        }),
      ).rejects.toThrow('errCoopUnavailable');
      expect(store.saveKeptRecovery).not.toHaveBeenCalled();
    });

    it('startRecovery with nothing to recover throws', async () => {
      await expect(
        startRecovery({
          mnemonic: 'm',
          destination: 'bc1q',
          feeRate: 3,
          raw: rawOf([]),
        }),
      ).rejects.toThrow('nothingToRecover');
    });

    it('startRecovery needing funding refuses while an exit runs', async () => {
      store.loadExitRecord.mockResolvedValue({ record: rec(), corrupt: false });
      await expect(
        startRecovery({
          mnemonic: 'm',
          destination: 'bc1q',
          feeRate: 3,
          raw: rawOf([uni('B')], { funding: { singleUtxoSats: 5000 } }),
        }),
      ).rejects.toThrow('errFinishExitFirst');
      expect(store.saveExitRecord).not.toHaveBeenCalled();
    });

    it('startRecovery needing funding splits co-signed leaves off, then opens a recover-mode exit', async () => {
      mockHandle.quoteExit.mockResolvedValue(rawOf([coop('A')]));
      mockHandle.buildExit.mockResolvedValue(builtOf('tx1', ['A']));
      const out = await startRecovery({
        mnemonic: 'm',
        destination: 'bc1q',
        feeRate: 3,
        raw: rawOf([coop('A'), uni('B')], {
          funding: { singleUtxoSats: 5000 },
        }),
      });
      expect(out).toEqual({ kept: false });
      expect(mockHandle.quoteExit).toHaveBeenCalledWith({
        destination: 'bc1q',
        feeRate: 3,
        leafIds: ['A'],
      });
      expect(store.saveKeptRecovery.mock.calls[0][1].leafIds).toEqual(['A']);
      const main = store.saveExitRecord.mock.calls[0][1];
      expect(main).toMatchObject({
        mode: 'recover',
        status: 'awaitingFee',
        leafIds: ['B'],
      });
    });

    describe('quoteRecovery (Glow quoteFresh)', () => {
      const ask = () =>
        quoteRecovery({ mnemonic: 'm', destination: 'bc1q', feeRate: 3 });

      it('returns the recoverable-only quote when nothing is held', async () => {
        const first = rawOf([coop('A')]);
        mockHandle.quoteExit.mockResolvedValue(first);
        await expect(ask()).resolves.toBe(first);
        expect(mockHandle.quoteExit).toHaveBeenCalledTimes(1);
        expect(mockHandle.quoteExit).toHaveBeenCalledWith({
          destination: 'bc1q',
          feeRate: 3,
          selection: 'recoverableOnly',
        });
      });

      it('quotes again without leaves the running exit or a kept recovery holds', async () => {
        store.loadExitRecord.mockResolvedValue({
          record: rec({ leafIds: ['A'] }),
          corrupt: false,
        });
        store.listKeptRecoveries.mockResolvedValue([
          keptRec({ leafIds: ['B'] }),
        ]);
        const second = rawOf([coop('C')]);
        mockHandle.quoteExit
          .mockResolvedValueOnce(rawOf([coop('A'), coop('B'), coop('C')]))
          .mockResolvedValueOnce(second);
        await expect(ask()).resolves.toBe(second);
        expect(mockHandle.quoteExit).toHaveBeenLastCalledWith({
          destination: 'bc1q',
          feeRate: 3,
          leafIds: ['C'],
        });
      });

      it('gives an empty quote when every leaf is held', async () => {
        store.loadExitRecord.mockResolvedValue({
          record: rec({ leafIds: ['A'] }),
          corrupt: false,
        });
        mockHandle.quoteExit.mockResolvedValue(
          rawOf([coop('A')], { funding: { singleUtxoSats: 5000 } }),
        );
        const out = await ask();
        expect(out.leaves).toEqual([]);
        expect(out.funding).toBeUndefined();
        expect(mockHandle.quoteExit).toHaveBeenCalledTimes(1);
      });

      it('ignores a finished exit', async () => {
        store.loadExitRecord.mockResolvedValue({
          record: rec({ status: 'done', leafIds: ['A'] }),
          corrupt: false,
        });
        const first = rawOf([coop('A')]);
        mockHandle.quoteExit.mockResolvedValue(first);
        await expect(ask()).resolves.toBe(first);
      });
    });

    it('a failed split leaves every leaf in the main recovery', async () => {
      mockHandle.quoteExit.mockRejectedValue(new Error('nope'));
      await startRecovery({
        mnemonic: 'm',
        destination: 'bc1q',
        feeRate: 3,
        raw: rawOf([coop('A'), uni('B')], {
          funding: { singleUtxoSats: 5000 },
        }),
      });
      expect(store.saveKeptRecovery).not.toHaveBeenCalled();
      expect(store.saveExitRecord.mock.calls[0][1].leafIds).toEqual(['A', 'B']);
    });

    it('startExit leaves mode unset', async () => {
      await startExit({
        mnemonic: 'm',
        destination: 'bc1q',
        feeRate: 3,
        quote: {
          leafIds: ['x'],
          receiveSats: 1,
          totalFeeSats: 1,
          fundingSats: 0,
          recoverableSats: 1,
        },
      });
      expect('mode' in store.saveExitRecord.mock.calls[0][1]).toBe(false);
    });
  });

  // Failure modes (H-2): an exit may take over a funded recover-mode record;
  // never an exit record, never while a pass runs, never a recovery over a record.
  describe('an exit taking over a running recovery (H-2)', () => {
    const recovering = (over = {}) =>
      rec({
        mode: 'recover',
        status: 'active',
        recovery: 'RECOVERY',
        fundingInputs: [{ txid: 'c1', vout: 0 }],
        leafIds: ['R1'],
        droppedLeafIds: ['D'],
        stoppedSince: 5,
        exitStateSnapshot: 'old',
        ...over,
      });
    const args = {
      mnemonic: 'm',
      destination: 'bc1q',
      feeRate: 3,
      quote: {
        leafIds: ['N1'],
        receiveSats: 9,
        totalFeeSats: 1,
        fundingSats: 5,
        recoverableSats: 10,
      },
    };

    it('carries the recovery, funding and leaves into a fresh exit record', async () => {
      store.loadExitRecord.mockResolvedValue({
        record: recovering(),
        corrupt: false,
      });
      const order = [];
      mockHandle.importExitState = jest.fn(async () => order.push('import'));
      mockHandle.exportExitState.mockImplementation(async () => {
        order.push('export');
        return 'SNAP';
      });
      await startExitEngine('m');
      await flush();
      await startExit(args);
      expect(order).toEqual(['import', 'export']);
      expect(mockHandle.importExitState).toHaveBeenCalledWith('old');
      const saved = store.saveExitRecord.mock.calls.at(-1)[1];
      expect('mode' in saved).toBe(false);
      expect(saved.status).toBe('awaitingFee');
      expect(saved.leafIds.sort()).toEqual(['N1', 'R1']);
      expect(saved.fundingInputs).toEqual([{ txid: 'c1', vout: 0 }]);
      expect(saved.recovery).toBe('RECOVERY');
      expect(saved.droppedLeafIds).toEqual(['D']);
      expect(saved.stoppedSince).toBe(5);
      expect(saved.exitStateSnapshot).toBe('SNAP');
    });

    it('runs no pass on the old record while the takeover is saved', async () => {
      store.loadExitRecord.mockResolvedValue({
        record: recovering(),
        corrupt: false,
      });
      mockHandle.importExitState = jest.fn(async () => {});
      await startExitEngine('m');
      await flush();
      runExitPass.mockClear();
      let finishExport;
      mockHandle.exportExitState.mockImplementation(
        () => new Promise(r => (finishExport = () => r('SNAP'))),
      );
      const started = startExit(args);
      await flush();
      // the app comes back to the foreground mid-takeover
      mockApp.listeners.forEach(fn => fn('active'));
      await flush();
      expect(runExitPass).not.toHaveBeenCalled();
      finishExport();
      await started;
      await flush();
      expect(runExitPass).toHaveBeenCalled();
      for (const [{ record }] of runExitPass.mock.calls) {
        expect(record.mode).toBeUndefined();
        expect(record.leafIds.sort()).toEqual(['N1', 'R1']);
      }
    });

    it('still refuses over a live exit record', async () => {
      store.loadExitRecord.mockResolvedValue({ record: rec(), corrupt: false });
      await expect(startExit(args)).rejects.toThrow('errExitInProgress');
      expect(store.saveExitRecord).not.toHaveBeenCalled();
    });

    it('a recovery still cannot take over a recovery or an exit', async () => {
      store.loadExitRecord.mockResolvedValue({
        record: recovering(),
        corrupt: false,
      });
      await expect(
        startRecovery({
          mnemonic: 'm',
          destination: 'bc1q',
          feeRate: 3,
          raw: {
            funding: { singleUtxoSats: 5000 },
            recoverableValueSats: 1,
            totalFeeSats: 1,
            leaves: [{ leafId: 'B', valueSats: 1, method: 'unilateral' }],
            skipped: [],
          },
        }),
      ).rejects.toThrow('errFinishExitFirst');
      expect(store.saveExitRecord).not.toHaveBeenCalled();
    });

    it('refuses while a pass is running', async () => {
      store.loadExitRecord.mockResolvedValue({
        record: recovering(),
        corrupt: false,
      });
      runExitPass.mockImplementation(() => new Promise(() => {}));
      await startExitEngine('m');
      await flush();
      await expect(startExit(args)).rejects.toThrow('errBusy');
      expect(store.saveExitRecord).not.toHaveBeenCalled();
    });

    it('shows a pass check error as lastError', async () => {
      store.loadExitRecord.mockResolvedValue({
        record: rec({ status: 'active' }),
        corrupt: false,
      });
      runExitPass.mockImplementation(async ({ record }) => ({
        ...record,
        checkError: 'bad recovery',
      }));
      await startExitEngine('m');
      await flush();
      expect(getExitSnapshot().lastError).toBe('bad recovery');
    });
  });
});
