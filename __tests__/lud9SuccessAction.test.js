import {
  getLNAddressForLiquidPayment,
  sanitizeLUD9SuccessAction,
} from '../app/components/admin/homeComponents/sendBitcoin/functions/payments';
import { decode } from '../app/functions/decodeBolt11';

jest.mock('bitcoin-address-parser', () => ({
  InputTypes: { LNURL_PAY: 'lnurl-pay' },
}));
jest.mock('../app/functions/sendBitcoin/getPhonePaymentAddress', () => ({
  fetchPhonePaymentInvoice: jest.fn(),
}));
jest.mock('../app/functions/decodeBolt11', () => ({ decode: jest.fn() }));

const callback = 'https://merchant.example/callback';
const receipt = {
  tag: 'url',
  description: 'Receipt',
  url: 'https://merchant.example/receipt',
};

describe('LUD-09 callback actions', () => {
  test('keeps an HTTPS receipt, including whitespace normalization', () => {
    expect(
      sanitizeLUD9SuccessAction({
        ...receipt,
        url: '  https://MERCHANT.example/receipt  ',
      }),
    ).toEqual({ ...receipt, url: 'https://MERCHANT.example/receipt' });
  });

  test('keeps a cross-domain HTTPS receipt (LUD-09 same-domain is not client-enforced)', () => {
    expect(
      sanitizeLUD9SuccessAction({
        ...receipt,
        url: 'https://receipts.other.example/order/1',
      }),
    ).toEqual({ ...receipt, url: 'https://receipts.other.example/order/1' });
  });

  test.each([
    'javascript:void(0)',
    'data:text/html,receipt',
    'http://merchant.example/receipt',
    'javascript://merchant.example/%0aalert(1)',
    '/receipt',
    '',
    null,
    {},
  ])('drops an unsafe receipt URL: %p', url => {
    expect(sanitizeLUD9SuccessAction({ ...receipt, url })).toBeNull();
  });

  test.each([null, undefined, false, 'receipt', []])(
    'rejects a non-object action: %p',
    action => {
      expect(sanitizeLUD9SuccessAction(action)).toBeNull();
    },
  );

  test.each([
    { tag: 'message', message: 'Thank you' },
    { tag: 'aes', description: 'Receipt', ciphertext: 'fixture', iv: 'fixture' },
  ])('strips URL fields from $tag actions without changing their payload', action => {
    const supplied = { ...action, url: 'javascript:void(0)' };
    expect(sanitizeLUD9SuccessAction(supplied)).toEqual(action);
    expect(supplied.url).toBe('javascript:void(0)');
  });

  describe('invoice callback integration', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      decode.mockReturnValue({ millisatoshis: '1000' });
      global.fetch = jest.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test.each([
      [receipt, receipt],
      [{ ...receipt, url: 'javascript:void(0)' }, null],
      [{ tag: 'message', message: 'Receipt', url: 'https://other.example' },
        { tag: 'message', message: 'Receipt' }],
    ])('returns only the invoice and sanitized action', async (supplied, expected) => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ pr: 'invoice-fixture', successAction: supplied }),
      });
      const result = await getLNAddressForLiquidPayment(
        { type: 'lnurl-pay', data: { callback } },
        1,
      );
      expect(result).toEqual({ pr: 'invoice-fixture', successAction: expected });
      expect(global.fetch).toHaveBeenCalledWith(`${callback}?amount=1000`);
    });
  });
});
