const LNURL_PAY = 'payRequest';
import {
  resolvePaymentMethod,
  requiresMethodChoice,
  descriptionAvailable,
  nextSendRoute,
  buildNextParams,
} from '../../../app/components/admin/homeComponents/sendBitcoin/functions/sendFlow';

const swapLimits = { bitcoin: 1000, usd: 1 };
const minUsdSwapAmount = 2000;
const bal = (bitcoinBalance, dollarBalanceSat, dollarBalanceToken = 5) => ({
  bitcoinBalance,
  dollarBalanceSat,
  dollarBalanceToken,
});
const ln = (amountSat = 5000, extra = {}, data = {}) => ({
  paymentNetwork: 'lightning',
  amountSat,
  data,
  ...extra,
});
const tokens = { expectedReceive: 'tokens' };

const resolve = args =>
  resolvePaymentMethod({
    paymentInfo: ln(),
    balances: bal(10000, 10000),
    flashnetReady: true,
    swapLimits,
    minUsdSwapAmount,
    ...args,
  });

const choice = args =>
  requiresMethodChoice({
    paymentInfo: ln(),
    balances: bal(10000, 10000),
    resolvedMethod: 'BTC',
    amountSat: 5000,
    fee: 10,
    flashnetReady: true,
    swapLimits,
    minUsdSwapAmount,
    ...args,
  });

describe('resolvePaymentMethod early returns', () => {
  it.each([
    ['missing paymentInfo', { paymentInfo: undefined }, undefined],
    ['empty paymentInfo', { paymentInfo: {} }, undefined],
    [
      'on-chain ignores preselected USD',
      {
        paymentInfo: { paymentNetwork: 'Bitcoin', amountSat: 5000 },
        preSelectedPaymentMethod: 'USD',
      },
      'BTC',
    ],
    [
      'token send',
      { isUsingLRC20: true, preSelectedPaymentMethod: 'USD' },
      'BTC',
    ],
    [
      'spark with full tokens display',
      {
        paymentInfo: { paymentNetwork: 'spark', amountSat: 5000 },
        useFullTokensDisplay: true,
      },
      'BTC',
    ],
    [
      'zero-amount lightning',
      {
        paymentInfo: ln(0, { usingZeroAmountInvoice: true }),
        balances: bal(0, 10000),
      },
      'BTC',
    ],
  ])('%s', (_n, args, expected) => {
    expect(resolve(args)).toBe(expected);
  });
});

describe('resolvePaymentMethod default pick', () => {
  it.each([
    ['sats tie goes to BTC', ln(), bal(10000, 10000), 'BTC'],
    ['sats BTC larger', ln(), bal(20000, 10000), 'BTC'],
    ['sats USD larger', ln(), bal(10000, 20000), 'USD'],
    ['tokens tie goes to USD', ln(5000, {}, tokens), bal(10000, 10000), 'USD'],
    ['tokens BTC larger', ln(5000, {}, tokens), bal(20000, 10000), 'BTC'],
    ['tokens USD larger', ln(5000, {}, tokens), bal(10000, 20000), 'USD'],
    ['sats only BTC viable', ln(), bal(10000, 0, 0), 'BTC'],
    ['sats only USD viable', ln(), bal(0, 10000), 'USD'],
    ['sats neither viable', ln(), bal(0, 0, 0), 'BTC'],
    ['sats BTC too small for amount', ln(), bal(4999, 4999, 0), 'BTC'],
    [
      'tokens USD short for amount',
      ln(5000, {}, tokens),
      bal(10000, 4999),
      'BTC',
    ],
    ['tokens BTC empty', ln(5000, {}, tokens), bal(0, 10000), 'USD'],
  ])('%s', (_n, paymentInfo, balances, expected) => {
    expect(resolve({ paymentInfo, balances })).toBe(expected);
  });

  it('dollarBalanceToken just below and at 0.01 (tokens receiver)', () => {
    const paymentInfo = ln(5000, {}, tokens);
    expect(resolve({ paymentInfo, balances: bal(10000, 20000, 0.009) })).toBe(
      'BTC',
    );
    expect(resolve({ paymentInfo, balances: bal(10000, 20000, 0.01) })).toBe(
      'USD',
    );
  });

  it('dollarBalanceToken below the usd swap limit (sats receiver)', () => {
    expect(resolve({ balances: bal(0, 10000, 0.99) })).toBe('BTC');
    expect(resolve({ balances: bal(0, 10000, 1) })).toBe('USD');
  });

  it('flashnet not ready blocks both swap directions', () => {
    expect(resolve({ flashnetReady: false, balances: bal(0, 10000) })).toBe(
      'BTC',
    );
    expect(
      resolve({
        flashnetReady: false,
        paymentInfo: ln(5000, {}, tokens),
        balances: bal(20000, 10000),
      }),
    ).toBe('USD');
  });

  it('swap minimum, sats receiver paying with USD', () => {
    const balances = bal(0, 10000);
    expect(resolve({ paymentInfo: ln(1000), balances })).toBe('USD');
    expect(resolve({ paymentInfo: ln(999), balances })).toBe('BTC');
  });

  it('swap minimum, tokens receiver paying with BTC', () => {
    const balances = bal(20000, 10000);
    expect(resolve({ paymentInfo: ln(2000, {}, tokens), balances })).toBe(
      'BTC',
    );
    expect(resolve({ paymentInfo: ln(1999, {}, tokens), balances })).toBe(
      'USD',
    );
  });

  it('editable amount counts as swap viable', () => {
    expect(
      resolve({
        paymentInfo: ln(999, { canEditPayment: true }),
        balances: bal(0, 10000),
      }),
    ).toBe('USD');
  });

  it('uses paymentInfo.amountSat for viability', () => {
    expect(
      resolve({
        paymentInfo: ln(5000),
        balances: bal(4999, 0, 0),
      }),
    ).toBe('BTC');
  });
});

describe('resolvePaymentMethod preferences', () => {
  it.each([
    ['preselected BTC usable', 'BTC', ln(), bal(10000, 10000), 'BTC'],
    [
      'preselected BTC unusable falls to USD',
      'BTC',
      ln(),
      bal(100, 10000),
      'USD',
    ],
    ['preselected USD usable', 'USD', ln(), bal(10000, 10000), 'USD'],
    [
      'preselected USD unusable falls to BTC',
      'USD',
      ln(),
      bal(10000, 10000, 0),
      'BTC',
    ],
    ['preselected neither usable stays', 'USD', ln(), bal(0, 0, 0), 'USD'],
    ['preselected BTC neither usable stays', 'BTC', ln(), bal(0, 0, 0), 'BTC'],
    [
      'tokens preselected USD short falls to BTC',
      'USD',
      ln(5000, {}, tokens),
      bal(10000, 100),
      'BTC',
    ],
    [
      'tokens preselected BTC below swap min falls to USD',
      'BTC',
      ln(1999, {}, tokens),
      bal(10000, 10000),
      'USD',
    ],
  ])('%s', (_n, preSelectedPaymentMethod, paymentInfo, balances, expected) => {
    expect(resolve({ preSelectedPaymentMethod, paymentInfo, balances })).toBe(
      expected,
    );
  });

  it('user method is returned unchecked', () => {
    expect(
      resolve({ userPaymentMethod: 'USD', balances: bal(10000, 0, 0) }),
    ).toBe('USD');
  });

  it('preselected beats user method', () => {
    expect(
      resolve({ preSelectedPaymentMethod: 'BTC', userPaymentMethod: 'USD' }),
    ).toBe('BTC');
  });

  it('inputCurrency resolves like a preference', () => {
    expect(resolve({ inputCurrency: 'USD' })).toBe('USD');
    expect(
      resolve({ inputCurrency: 'USD', balances: bal(10000, 10000, 0) }),
    ).toBe('BTC');
  });

  it('user method beats inputCurrency', () => {
    expect(resolve({ userPaymentMethod: 'BTC', inputCurrency: 'USD' })).toBe(
      'BTC',
    );
  });
});

describe('requiresMethodChoice early returns', () => {
  it.each([
    ['unresolved method', { resolvedMethod: undefined }],
    ['preselected method', { preSelectedPaymentMethod: 'BTC' }],
    ['full tokens display', { useFullTokensDisplay: true }],
    ['token send', { isUsingLRC20: true }],
    ['already selected', { didSelectPaymentMethod: true }],
    ['flashnet not ready', { flashnetReady: false }],
    [
      'on-chain',
      { paymentInfo: { paymentNetwork: 'Bitcoin', amountSat: 5000 } },
    ],
    [
      'zero-amount lightning',
      { paymentInfo: ln(0, { usingZeroAmountInvoice: true }), amountSat: 0 },
    ],
  ])('%s', (_n, args) => {
    expect(choice(args)).toBe(false);
  });
});

describe('requiresMethodChoice', () => {
  it.each([
    ['both can pay', bal(10000, 10000), true],
    ['neither can pay', bal(0, 0), true],
    ['only BTC can pay', bal(10000, 0), false],
    ['only USD can pay', bal(0, 10000), false],
  ])('%s', (_n, balances, expected) => {
    expect(choice({ balances })).toBe(expected);
  });

  it('swap minimum, sats receiver resolved BTC', () => {
    expect(choice({ paymentInfo: ln(1000), amountSat: 1000, fee: 0 })).toBe(
      true,
    );
    expect(choice({ paymentInfo: ln(999), amountSat: 999, fee: 0 })).toBe(
      false,
    );
  });

  it('swap minimum, tokens receiver resolved USD', () => {
    expect(
      choice({
        paymentInfo: ln(2000, {}, tokens),
        resolvedMethod: 'USD',
        amountSat: 2000,
        fee: 0,
      }),
    ).toBe(true);
    expect(
      choice({
        paymentInfo: ln(1999, {}, tokens),
        resolvedMethod: 'USD',
        amountSat: 1999,
        fee: 0,
      }),
    ).toBe(false);
  });

  it('editable amount counts as swap viable', () => {
    expect(
      choice({
        paymentInfo: ln(999, { canEditPayment: true }),
        amountSat: 999,
        fee: 0,
      }),
    ).toBe(true);
  });

  it('result follows amountSat (B2)', () => {
    const args = { balances: bal(10000, 5100), fee: 0 };
    expect(choice({ ...args, amountSat: 5100 })).toBe(true);
    expect(choice({ ...args, amountSat: 5101 })).toBe(false);
  });

  it('result follows fee for lightning (B2)', () => {
    const args = { balances: bal(10000, 5100), amountSat: 5000 };
    expect(choice({ ...args, fee: 100 })).toBe(true);
    expect(choice({ ...args, fee: 101 })).toBe(false);
  });

  it('fee ignored for non-lightning', () => {
    expect(
      choice({
        paymentInfo: { paymentNetwork: 'spark', amountSat: 5000, data: {} },
        balances: bal(10000, 5100),
        amountSat: 5000,
        fee: 500,
      }),
    ).toBe(true);
  });
});

describe('descriptionAvailable', () => {
  it.each([
    ['contact', { paymentNetwork: 'lightning' }, { name: 'a' }, true],
    // Spark memos stay on the sender's tx, so the receiver can't see a note.
    ['spark', { paymentNetwork: 'spark' }, undefined, false],
    [
      'Blitz user by name, not a contact',
      { paymentNetwork: 'spark', blitzContactInfo: { name: 'a' } },
      undefined,
      false,
    ],
    [
      'LNURL with comment',
      {
        type: LNURL_PAY,
        paymentNetwork: 'lightning',
        data: { commentAllowed: 100 },
      },
      undefined,
      true,
    ],
    [
      'LNURL comment 0',
      {
        type: LNURL_PAY,
        paymentNetwork: 'lightning',
        data: { commentAllowed: 0 },
      },
      undefined,
      false,
    ],
    ['on-chain', { paymentNetwork: 'Bitcoin' }, undefined, false],
    [
      'zero-amount BOLT11',
      { paymentNetwork: 'lightning', usingZeroAmountInvoice: true, data: {} },
      undefined,
      false,
    ],
  ])('%s', (_n, paymentInfo, contactInfo, expected) => {
    expect(descriptionAvailable(paymentInfo, contactInfo)).toBe(expected);
  });
});

describe('nextSendRoute', () => {
  it.each([
    [{ canEditPayment: true }, false, 'SendAmount'],
    [{}, true, 'SendAmount'],
    [{}, false, 'SendReview'],
  ])('%j choice=%s -> %s', (paymentInfo, needsMethodChoice, expected) => {
    expect(nextSendRoute({ paymentInfo, needsMethodChoice })).toBe(expected);
  });
});

describe('buildNextParams', () => {
  it('forwards every route param', () => {
    const routeParams = {
      publishMessageFunc: () => {},
      selectedContact: { a: 1 },
      retrivedContact: { b: 2 },
      fromPage: 'contacts',
      contactInfo: { c: 3 },
      paymentDisplayCurrency: 'EUR',
    };
    const out = buildNextParams(routeParams, { extra: 1 });
    expect(out).toEqual({ ...routeParams, extra: 1 });
    expect(out.publishMessageFunc).toBe(routeParams.publishMessageFunc);
  });

  it('additions override', () => {
    expect(
      buildNextParams({ fromPage: 'a' }, { fromPage: 'SendAmount' }),
    ).toEqual({
      fromPage: 'SendAmount',
    });
  });
});
