// handleCryptoQRAddress fetches an LNURL-pay endpoint on the address's host.
// Ways the host check can fail open (each must never reach fetch):
//  1. A lookalike host that merely contains cryptoqr.net.
//  2. A URL delimiter that moves the real host before the suffix.
//  3. Userinfo/port tricks.
const {
  handleCryptoQRAddress,
} = require('../../../app/functions/sendBitcoin/getMerchantAddress');

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 404 }));
});

test.each([
  'bob@cryptoqr.net.evil.com',
  'bob@evilcryptoqr.net',
  'bob@evil.com#.cryptoqr.net',
  'bob@evil.com/.cryptoqr.net',
  'bob@evil.com?.cryptoqr.net',
  'bob@evil.com:443.cryptoqr.net',
])('never fetches a non-cryptoqr host: %s', async address => {
  await handleCryptoQRAddress(address).catch(() => {});
  expect(global.fetch).not.toHaveBeenCalled();
});

test.each(['bob@cryptoqr.net', 'bob@staging.cryptoqr.net'])(
  'fetches the cryptoqr endpoint for %s',
  async address => {
    await handleCryptoQRAddress(address).catch(() => {});
    expect(global.fetch).toHaveBeenCalledWith(
      `https://${address.split('@')[1]}/.well-known/lnurlp/bob`,
    );
  },
);
