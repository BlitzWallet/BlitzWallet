// The recipient pill names AND illustrates the asset that LEFT the wallet, not the
// rail it took — no lightning bolts or spark logos for bitcoin/dollar sends. USDB
// rides the same LRC20 rails as any other token, so the token id is the only thing
// separating "Dollar payment" from "Token payment" — these assertions are what stops
// a dollar-funded send from reading "Bitcoin payment" or showing a bolt again.

const USDB = 'usdb-token-id';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-country-flag', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../app/constants', () => ({
  COLORS: {},
  ICONS: {},
  USDB_TOKEN_ID: 'usdb-token-id',
}));
jest.mock(
  '../app/components/admin/homeComponents/contacts/internalComponents/profileImage',
  () => ({ __esModule: true, default: () => null }),
);
jest.mock('i18next', () => ({
  __esModule: true,
  default: {
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
  },
}));

const {
  resolveRecipientDisplay,
} = require('../app/components/admin/homeComponents/sendBitcoin/components/recipientCard');

const LIGHTNING = 'wallet.sendPages.sendPaymentScreen.lightningPayment';
const DOLLAR = 'wallet.sendPages.sendPaymentScreen.dollarPayment';
const TOKEN = 'wallet.sendPages.sendPaymentScreen.tokenPayment';

const tx = (paymentType, details = {}) => ({ paymentType, details });

describe('resolveRecipientDisplay payment asset label', () => {
  it('labels a bitcoin-funded lightning send "Bitcoin payment"', () => {
    const resolved = resolveRecipientDisplay({
      transaction: tx('lightning', { isLRC20Payment: false }),
    });
    expect(resolved).toMatchObject({
      kind: 'asset',
      asset: 'bitcoin',
      displayName: LIGHTNING,
    });
  });

  it('labels a dollar-funded lightning send "Dollar payment"', () => {
    const resolved = resolveRecipientDisplay({
      transaction: tx('lightning', {
        isLRC20Payment: true,
        LRC20Token: USDB,
      }),
    });
    // Asset, not rail: dollars over lightning is a dollar icon, never a bolt.
    expect(resolved).toMatchObject({
      kind: 'asset',
      asset: 'dollar',
      displayName: DOLLAR,
    });
  });

  it('labels a dollar-funded spark send "Dollar payment"', () => {
    const resolved = resolveRecipientDisplay({
      transaction: tx('spark', { isLRC20Payment: true, LRC20Token: USDB }),
    });
    expect(resolved).toMatchObject({
      kind: 'asset',
      asset: 'dollar',
      displayName: DOLLAR,
    });
  });

  it('shows the dollar icon for a USD-funded bolt11 (recorded as spark)', () => {
    // payments.js writes this shape: the swap leaves as USDB over spark rails,
    // but the destination is a bolt11. Either way the user sent dollars.
    const resolved = resolveRecipientDisplay({
      transaction: tx('spark', {
        isLRC20Payment: true,
        LRC20Token: USDB,
        destinationChain: 'lightning',
      }),
    });
    expect(resolved).toMatchObject({
      kind: 'asset',
      asset: 'dollar',
      displayName: DOLLAR,
    });
  });

  it('labels a non-USDB LRC20 send "Token payment" and keeps the spark logo', () => {
    const resolved = resolveRecipientDisplay({
      transaction: tx('spark', {
        isLRC20Payment: true,
        LRC20Token: 'some-other-token-id',
      }),
    });
    expect(resolved).toMatchObject({ kind: 'spark', displayName: TOKEN });
  });

  it('labels a bitcoin-funded spark send "Bitcoin payment"', () => {
    const resolved = resolveRecipientDisplay({
      transaction: tx('spark', { isLRC20Payment: false, LRC20Token: '' }),
    });
    expect(resolved).toMatchObject({
      asset: 'bitcoin',
      displayName: LIGHTNING,
    });
  });

  it('labels an on-chain send "Bitcoin payment"', () => {
    const resolved = resolveRecipientDisplay({
      transaction: tx('bitcoin'),
    });
    expect(resolved).toMatchObject({
      asset: 'bitcoin',
      displayName: LIGHTNING,
    });
  });

  it('shows the dollar icon for a dollar-funded on-chain send', () => {
    const resolved = resolveRecipientDisplay({
      transaction: tx('bitcoin', { isLRC20Payment: true, LRC20Token: USDB }),
    });
    expect(resolved).toMatchObject({ asset: 'dollar', displayName: DOLLAR });
  });

  it('names the asset + chain for an external stablecoin, not the spark type', () => {
    const resolved = resolveRecipientDisplay({
      // A stablecoin send is also paymentType 'spark' with LRC20Token USDB, so
      // this only passes while the stablecoin check runs ahead of both.
      transaction: tx('spark', { isLRC20Payment: true, LRC20Token: USDB }),
      stablecoinInfo: { asset: 'USDC', label: 'Base' },
    });
    expect(resolved.kind).toBe('stablecoin');
    expect(resolved.displayName).toBe(
      'screens.inAccount.confirmTxPage.stablecoinDesc:{"asset":"USDC","chain":"Base"}',
    );
  });

  it('prefers a named recipient over any asset label', () => {
    const resolved = resolveRecipientDisplay({
      contactInfo: { name: 'Satoshi' },
      transaction: tx('spark', { isLRC20Payment: true, LRC20Token: USDB }),
    });
    expect(resolved).toMatchObject({ kind: 'contact', displayName: 'Satoshi' });
  });

  it('returns null when there is nothing to name', () => {
    expect(resolveRecipientDisplay({})).toBeNull();
  });

  it('falls through a contact with no name and no image instead of an empty pill', () => {
    const resolved = resolveRecipientDisplay({
      contactInfo: { uuid: 'abc' },
      transaction: tx('bitcoin'),
    });
    expect(resolved).toMatchObject({ kind: 'asset', asset: 'bitcoin' });
  });
});
