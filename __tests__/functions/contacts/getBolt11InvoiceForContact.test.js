// The contact lnurlp server must not be able to make us pay a different
// amount than the one the user confirmed.
jest.mock('../../../app/functions/decodeBolt11', () => ({ decode: jest.fn() }));

const { decode } = require('../../../app/functions/decodeBolt11');
const {
  getBolt11InvoiceForContact,
} = require('../../../app/functions/contacts/index');

describe('getBolt11InvoiceForContact amount check', () => {
  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ status: 'OK', pr: 'lnbc_test' }),
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('returns the invoice when its amount matches (decoder gives msat as a string)', async () => {
    decode.mockReturnValue({ millisatoshis: '1000000' });
    const result = await getBolt11InvoiceForContact('bob', 1000, '');
    expect(result.pr).toBe('lnbc_test');
  });

  it.each([
    ['a different amount', () => ({ millisatoshis: '1000000000' })],
    ['no amount', () => ({ millisatoshis: null })],
    [
      'an undecodable invoice',
      () => {
        throw new Error('bad invoice');
      },
    ],
  ])('rejects %s', async (_, impl) => {
    decode.mockImplementation(impl);
    const result = await getBolt11InvoiceForContact('bob', 1000, '');
    expect(result.pr).toBeFalsy();
  });
});
