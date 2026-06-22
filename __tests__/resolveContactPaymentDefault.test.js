import { resolveContactPaymentDefault } from '../app/components/admin/homeComponents/contacts/hooks/resolveContactPaymentDefault';

// The helper was intentionally reduced to always default to BTC (commit
// "defualt to btc only"). It no longer derives a currency from the contact's
// or user's preferences, so every path resolves to 'BTC'. These tests lock in
// that contract across the scenarios that previously branched to USD.
describe('resolveContactPaymentDefault', () => {
  it('defaults a USD-pref contact send to BTC', () => {
    expect(
      resolveContactPaymentDefault({
        paymentType: 'send',
        prefetchedDoc: { lnurlReceiveCurrency: 'usd' },
        isLNURL: false,
        masterInfoObject: {},
        dollarBalanceToken: 12,
      }),
    ).toBe('BTC');
  });

  it('defaults a cached USD contact receive option to BTC', () => {
    expect(
      resolveContactPaymentDefault({
        paymentType: 'send',
        prefetchedDoc: { lnurlReceiveCurrency: 'btc' },
        contactReceiveOption: 'USD',
        isLNURL: false,
        masterInfoObject: {},
        dollarBalanceToken: 12,
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

  it('defaults requests to BTC even when the user LNURL currency is USD', () => {
    expect(
      resolveContactPaymentDefault({
        paymentType: 'request',
        prefetchedDoc: null,
        isLNURL: false,
        masterInfoObject: { lnurlReceiveCurrency: 'usd' },
        dollarBalanceToken: 0,
      }),
    ).toBe('BTC');
  });
});
