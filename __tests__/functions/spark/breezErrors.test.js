// Breez RN error handling, driven only by error objects the SDK really threw
// (see fixtures/breezRnErrors.ios-0.28.0.json, captured from the running app).
//
// Ways this can fail (written before the fix):
//  1. RN errors carry `message: 'SdkError.<Variant>'` and the real text in
//     `inner[0]`; messageOf read `message`, so users saw a class name.
//  2. Send-time "Tree service error: insufficient funds" comes tagged
//     SparkError, so it classified as sparkError -> outcome 'unknown' ("may
//     have been sent") although Breez raises it only while selecting leaves,
//     before any transfer exists (spark-wallet wallet.rs select_leaves_*).
//  3. A fix must not move any other kind: storage / chainService / generic
//     stay 'unknown', invalidInput stays 'failed'.
//  4. Missing-payment detection must still see "Query returned no rows".
//  5. App-made errors (fee cap) keep their own message and tag.
import fixture from './fixtures/breezRnErrors.ios-0.28.0.json';
import {
  asSendResult,
  classifyBreezError,
  isMissingPaymentError,
} from '../../../app/functions/spark/breezErrors';

const mockDb = { runAsync: jest.fn(), getFirstAsync: jest.fn() };
jest.mock('../../../app/functions/spark/transactions', () => ({
  getSparkDatabase: jest.fn(async () => mockDb),
}));
const { withSendIntent } = require('../../../app/functions/spark/sendIntents');

// Rebuild the thrown object exactly as captured: an Error whose own
// `message` is the placeholder, plus `tag` / `inner` (and walletRuntime's
// `preSend` flag where it was present).
const rebuild = ({ tag, message, inner, preSend }) =>
  Object.assign(new Error(message), { tag, inner }, preSend ? { preSend } : {});

const byCall = call => {
  const c = fixture.cases.find(x => x.call === call);
  if (!c) throw new Error(`fixture missing: ${call}`);
  return c;
};

// Expected result per captured call: [kind, outcome when thrown by a send].
const EXPECTED = {
  'getPayment(unknown uuid)': ['storage', 'unknown'],
  'prepare(garbage destination)': ['invalidInput', 'failed'],
  'prepare(bitcoin address, 100 sats, empty wallet)': [
    'invalidInput',
    'failed',
  ],
  'prepare(bitcoin address, 100000 sats, empty wallet)': [
    'insufficientFunds',
    'failed',
  ],
  'fetchClaimDepositQuote(unknown txid)': ['chainService', 'unknown'],
  'claimDeposit(unknown txid)': ['chainService', 'unknown'],
  'importUnilateralExitState(garbage)': ['invalidInput', 'failed'],
  'send(spark address 1000 sats, empty wallet, uuid key)': [
    'insufficientFunds',
    'failed',
  ],
  'send(spark address 1000 sats, empty wallet, non-uuid key)': [
    'generic',
    'unknown',
  ],
  'send(own bolt11 invoice, empty wallet)': ['insufficientFunds', 'failed'],
};

describe('captured fixture', () => {
  it('covers every expected call and only real SDK shapes', () => {
    expect(fixture.cases.map(c => c.call).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
    for (const c of fixture.cases) {
      expect(c.error.message).toBe(`SdkError.${c.error.tag}`);
      expect(c.error.inner).toHaveLength(1);
    }
  });
});

describe.each(fixture.cases.map(c => [c.call, c]))('%s', (call, c) => {
  const [kind, outcome] = EXPECTED[call];
  const error = rebuild(c.error);

  it('shows the SDK reason, not the SdkError class name', () => {
    expect(c.beforeFix.message).toBe(c.error.message); // the old behaviour
    expect(classifyBreezError(error).message).toBe(c.error.inner[0]);
  });

  it(`classifies as ${kind} with send outcome ${outcome}`, () => {
    expect(classifyBreezError(error).kind).toBe(kind);
    expect(asSendResult(error).outcome).toBe(outcome);
  });

  it('is a missing payment only for the unknown-id lookup', () => {
    expect(isMissingPaymentError(error)).toBe(
      call === 'getPayment(unknown uuid)',
    );
  });
});

describe('withSendIntent on real send-time errors', () => {
  beforeEach(() => {
    mockDb.runAsync.mockReset();
    mockDb.getFirstAsync.mockReset();
  });

  const run = async call => {
    const error = rebuild(byCall(call).error);
    const r = await withSendIntent(
      { accountId: 'acct', rail: 'sparkAddress', requestHash: 'h', amount: 1 },
      async () => {
        throw error;
      },
    );
    const mark = mockDb.runAsync.mock.calls.find(([sql]) =>
      /UPDATE breez_send_intents/.test(sql),
    );
    // markIntent binds [state, paymentId, error, intentId]
    return { r, state: mark[1][0], storedError: mark[1][2] };
  };

  it('empty-wallet send is a definitive failure, intent abandoned', async () => {
    const { r, state, storedError } = await run(
      'send(spark address 1000 sats, empty wallet, uuid key)',
    );
    expect(r.ok).toBe(false);
    expect(r.result.outcome).toBe('failed');
    expect(r.result.error).toBe('Tree service error: insufficient funds');
    expect(state).toBe('abandoned');
    expect(storedError).toBe('Tree service error: insufficient funds');
  });

  it('a generic send error stays unknown, intent kept unknown', async () => {
    const { r, state } = await run(
      'send(spark address 1000 sats, empty wallet, non-uuid key)',
    );
    expect(r.result.outcome).toBe('unknown');
    expect(r.result.error).toBe('Invalid TransferId format');
    expect(state).toBe('unknown');
  });
});

describe('app-made errors keep their own text', () => {
  it('lightning fee-cap refusal (index.js sendSparkLightningPayment)', () => {
    const e = Object.assign(new Error('Prepared fee 1200 exceeds max 1000'), {
      tag: 'InvalidInput',
    });
    expect(classifyBreezError(e)).toMatchObject({
      kind: 'invalidInput',
      message: 'Prepared fee 1200 exceeds max 1000',
    });
    expect(asSendResult(e).outcome).toBe('failed');
  });
});
