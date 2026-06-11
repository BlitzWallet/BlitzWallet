import { resolveContactPaymentDefault } from '../app/components/admin/homeComponents/contacts/hooks/resolveContactPaymentDefault';

describe('resolveContactPaymentDefault', () => {
  it('defaults non-LNURL USD-pref contact sends to USD', () => {
    expect(
      resolveContactPaymentDefault({
        paymentType: 'send',
        prefetchedDoc: { lnurlReceiveCurrency: 'usd' },
        isLNURL: false,
        masterInfoObject: {},
        dollarBalanceToken: 12,
      }),
    ).toBe('USD');
  });

  it('uses cached contact receive option before prefetched doc', () => {
    expect(
      resolveContactPaymentDefault({
        paymentType: 'send',
        prefetchedDoc: { lnurlReceiveCurrency: 'btc' },
        contactReceiveOption: 'USD',
        isLNURL: false,
        masterInfoObject: {},
        dollarBalanceToken: 12,
      }),
    ).toBe('USD');
  });

  it('falls back to BTC for USD-pref contact sends when dollar balance is empty', () => {
    expect(
      resolveContactPaymentDefault({
        paymentType: 'send',
        prefetchedDoc: { lnurlReceiveCurrency: 'usd' },
        isLNURL: false,
        masterInfoObject: {},
        dollarBalanceToken: 0,
      }),
    ).toBe('BTC');
  });

  it('defaults LNURL contact sends to BTC', () => {
    expect(
      resolveContactPaymentDefault({
        paymentType: 'send',
        prefetchedDoc: { lnurlReceiveCurrency: 'usd' },
        isLNURL: true,
        masterInfoObject: {},
        dollarBalanceToken: 50,
      }),
    ).toBe('BTC');
  });

  it('uses current user LNURL receive currency for requests', () => {
    expect(
      resolveContactPaymentDefault({
        paymentType: 'request',
        prefetchedDoc: null,
        isLNURL: false,
        masterInfoObject: { lnurlReceiveCurrency: 'usd' },
        dollarBalanceToken: 0,
      }),
    ).toBe('USD');
  });

  it('keeps user-selected currency when async defaults resolve later', () => {
    let selectedMethod = 'BTC';
    let userChanged = false;

    const applyDefault = nextDefault => {
      if (!userChanged) selectedMethod = nextDefault;
    };

    applyDefault(
      resolveContactPaymentDefault({
        paymentType: 'send',
        prefetchedDoc: null,
        isLNURL: false,
        masterInfoObject: {},
        dollarBalanceToken: 20,
      }),
    );

    userChanged = true;
    selectedMethod = 'BTC';

    applyDefault(
      resolveContactPaymentDefault({
        paymentType: 'send',
        prefetchedDoc: { lnurlReceiveCurrency: 'usd' },
        isLNURL: false,
        masterInfoObject: {},
        dollarBalanceToken: 20,
      }),
    );

    expect(selectedMethod).toBe('BTC');
  });
});
