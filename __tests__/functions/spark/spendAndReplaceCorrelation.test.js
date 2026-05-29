// Unit tests for the SAR incoming-tx correlation core. fetchBackend and the
// storage query are mocked; the db handle is an opaque object (only passed to
// the mocked query). i18next.t echoes its key so we can assert the label.
jest.mock('../../../db/handleBackend', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../app/functions/spark/spendAndReplaceStorage', () => ({
  getPendingSpendAndReplaceFundingLegs: jest.fn(),
}));

jest.mock('i18next', () => ({
  __esModule: true,
  default: { t: jest.fn(key => key) },
}));

const fetchBackend = require('../../../db/handleBackend').default;
const {
  getPendingSpendAndReplaceFundingLegs,
} = require('../../../app/functions/spark/spendAndReplaceStorage');
const {
  setSpendAndReplaceAuthKeys,
  labelSpendAndReplaceIncoming,
} = require('../../../app/functions/spark/spendAndReplaceCorrelation');

const ACCOUNT = 'acct-1';
const ACCEPTING_KEY = 'screens.inAccount.sendAndReplace.acceptingDescription';
const db = {};

// Unique per-call hash so the module's short-TTL memo never bleeds between tests.
let hashCounter = 0;
const uniqueHash = () => `hash-${++hashCounter}`;

const incomingSparkTx = id => ({
  id,
  paymentType: 'spark',
  paymentStatus: 'pending',
  accountId: ACCOUNT,
  details: { direction: 'INCOMING', amount: 5000 },
});

const fundingLeg = legId => ({
  funding_leg_spark_id: legId,
  quote_id: `quote-${legId}`,
  source_spark_address: `addr-${legId}`,
});

const flush = () => new Promise(resolve => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  setSpendAndReplaceAuthKeys('priv', 'pub');
  getPendingSpendAndReplaceFundingLegs.mockResolvedValue([]);
});

describe('labelSpendAndReplaceIncoming', () => {
  it('no incoming spark tx in batch → no DB query, no backend call', async () => {
    const outgoing = {
      id: uniqueHash(),
      paymentType: 'spark',
      paymentStatus: 'pending',
      accountId: ACCOUNT,
      details: { direction: 'OUTGOING' },
    };
    await labelSpendAndReplaceIncoming([outgoing], db);

    expect(getPendingSpendAndReplaceFundingLegs).not.toHaveBeenCalled();
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it('empty batch → no DB query, no backend call', async () => {
    await labelSpendAndReplaceIncoming([], db);
    expect(getPendingSpendAndReplaceFundingLegs).not.toHaveBeenCalled();
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it('incoming spark tx present but no pending funding legs → tx untouched, no backend call', async () => {
    getPendingSpendAndReplaceFundingLegs.mockResolvedValue([]);
    const tx = incomingSparkTx(uniqueHash());

    await labelSpendAndReplaceIncoming([tx], db);

    expect(getPendingSpendAndReplaceFundingLegs).toHaveBeenCalledWith(db, ACCOUNT);
    expect(fetchBackend).not.toHaveBeenCalled();
    expect(tx.details.description).toBeUndefined();
    expect(tx.paymentStatus).toBe('pending');
  });

  it('matching completed leg → labels the incoming tx and marks it completed', async () => {
    const incomingId = uniqueHash();
    const leg = fundingLeg(uniqueHash());
    getPendingSpendAndReplaceFundingLegs.mockResolvedValue([leg]);
    fetchBackend.mockResolvedValue({
      status: 'completed',
      sparkTxHash: incomingId,
    });

    const tx = incomingSparkTx(incomingId);
    await labelSpendAndReplaceIncoming([tx], db);

    expect(fetchBackend).toHaveBeenCalledWith(
      'checkFlashnetStablecoinStatus',
      {
        quoteId: leg.quote_id,
        sourceSparkAddress: leg.source_spark_address,
        sparkTxHash: leg.funding_leg_spark_id,
      },
      'priv',
      'pub',
    );
    expect(tx.details.description).toBe(ACCEPTING_KEY);
    expect(tx.paymentStatus).toBe('completed');
  });

  it('non-matching returned hash → tx untouched', async () => {
    getPendingSpendAndReplaceFundingLegs.mockResolvedValue([fundingLeg(uniqueHash())]);
    fetchBackend.mockResolvedValue({
      status: 'completed',
      sparkTxHash: uniqueHash(), // different from the tx id
    });

    const tx = incomingSparkTx(uniqueHash());
    await labelSpendAndReplaceIncoming([tx], db);

    expect(tx.details.description).toBeUndefined();
    expect(tx.paymentStatus).toBe('pending');
  });

  it('non-completed status → tx untouched', async () => {
    const incomingId = uniqueHash();
    getPendingSpendAndReplaceFundingLegs.mockResolvedValue([fundingLeg(uniqueHash())]);
    fetchBackend.mockResolvedValue({ status: 'pending', sparkTxHash: incomingId });

    const tx = incomingSparkTx(incomingId);
    await labelSpendAndReplaceIncoming([tx], db);

    expect(tx.details.description).toBeUndefined();
    expect(tx.paymentStatus).toBe('pending');
  });

  it('two pending legs → both backend calls fire in parallel; one rejection does not drop the other', async () => {
    const incomingA = uniqueHash();
    const incomingB = uniqueHash();
    const legA = fundingLeg(uniqueHash());
    const legB = fundingLeg(uniqueHash());
    getPendingSpendAndReplaceFundingLegs.mockResolvedValue([legA, legB]);

    const resolvers = [];
    fetchBackend.mockImplementation(
      () => new Promise((resolve, reject) => resolvers.push({ resolve, reject })),
    );

    const txA = incomingSparkTx(incomingA);
    const txB = incomingSparkTx(incomingB);
    const p = labelSpendAndReplaceIncoming([txA, txB], db);

    // Both backend calls are issued synchronously, before either resolves.
    await flush();
    expect(fetchBackend).toHaveBeenCalledTimes(2);
    expect(resolvers).toHaveLength(2);

    // legA rejects, legB completes with a matching incoming hash.
    resolvers[0].reject(new Error('leg A backend error'));
    resolvers[1].resolve({ status: 'completed', sparkTxHash: incomingB });
    await p;

    expect(txA.details.description).toBeUndefined();
    expect(txA.paymentStatus).toBe('pending');
    expect(txB.details.description).toBe(ACCEPTING_KEY);
    expect(txB.paymentStatus).toBe('completed');
  });

  it('outgoing and non-spark txs are ignored as candidates', async () => {
    const outgoing = {
      id: uniqueHash(),
      paymentType: 'spark',
      paymentStatus: 'pending',
      accountId: ACCOUNT,
      details: { direction: 'OUTGOING' },
    };
    const lightning = {
      id: uniqueHash(),
      paymentType: 'lightning',
      paymentStatus: 'pending',
      accountId: ACCOUNT,
      details: { direction: 'INCOMING' },
    };
    const fundingLegTx = {
      id: uniqueHash(),
      paymentType: 'spark',
      paymentStatus: 'pending',
      accountId: ACCOUNT,
      details: { direction: 'INCOMING', isFlashnetStablecoin: true },
    };

    await labelSpendAndReplaceIncoming([outgoing, lightning, fundingLegTx], db);

    expect(getPendingSpendAndReplaceFundingLegs).not.toHaveBeenCalled();
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it('no auth keys set → no DB query, no backend call', async () => {
    setSpendAndReplaceAuthKeys(null, null);
    const tx = incomingSparkTx(uniqueHash());

    await labelSpendAndReplaceIncoming([tx], db);

    expect(getPendingSpendAndReplaceFundingLegs).not.toHaveBeenCalled();
    expect(fetchBackend).not.toHaveBeenCalled();
    expect(tx.paymentStatus).toBe('pending');
  });

  it('backend stalls past the timeout → resolves without labeling', async () => {
    jest.useFakeTimers();
    try {
      getPendingSpendAndReplaceFundingLegs.mockResolvedValue([fundingLeg(uniqueHash())]);
      fetchBackend.mockImplementation(() => new Promise(() => {})); // never resolves

      const tx = incomingSparkTx(uniqueHash());
      const p = labelSpendAndReplaceIncoming([tx], db);

      // Let the synchronous backend dispatch run, then trip the internal timeout.
      await jest.advanceTimersByTimeAsync(4000);
      await p;

      expect(tx.details.description).toBeUndefined();
      expect(tx.paymentStatus).toBe('pending');
    } finally {
      jest.useRealTimers();
    }
  });

  it('parses stringified details and writes the parsed object back', async () => {
    const incomingId = uniqueHash();
    getPendingSpendAndReplaceFundingLegs.mockResolvedValue([fundingLeg(uniqueHash())]);
    fetchBackend.mockResolvedValue({ status: 'completed', sparkTxHash: incomingId });

    const tx = {
      id: incomingId,
      paymentType: 'spark',
      paymentStatus: 'pending',
      accountId: ACCOUNT,
      details: JSON.stringify({ direction: 'INCOMING', amount: 5000 }),
    };
    await labelSpendAndReplaceIncoming([tx], db);

    expect(typeof tx.details).toBe('object');
    expect(tx.details.description).toBe(ACCEPTING_KEY);
    expect(tx.paymentStatus).toBe('completed');
  });
});
