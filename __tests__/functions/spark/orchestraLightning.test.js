import {
  getLightningInvoiceAmountSats,
  mapOrchestraQuoteToLightningQuote,
  normalizeOrchestraBackendError,
} from '../../../app/functions/spark/orchestraLightning';

const FIXED_AMOUNT_INVOICE =
  'lnbc20u1pvjluezhp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqfppqw508d6qejxtdg4y5r3zarvary0c5xw7kxqrrsssp5m6kmam774klwlh4dhmhaatd7al02m0h0m6kmam774klwlh4dhmhs9qypqqqcqpf3cwux5979a8j28d4ydwahx00saa68wq3az7v9jdgzkghtxnkf3z5t7q5suyq2dl9tqwsap8j0wptc82cpyvey9gf6zyylzrm60qtcqsq7egtsq';

describe('orchestraLightning helpers', () => {
  test('decodes fixed-amount BOLT11 invoice sats', () => {
    expect(getLightningInvoiceAmountSats(FIXED_AMOUNT_INVOICE)).toBe(2000);
  });

  test('uses explicit amount override before decoding invoice', () => {
    expect(getLightningInvoiceAmountSats('not-an-invoice', 1234)).toBe(1234);
  });

  test('maps Orchestra quote response to legacy Lightning quote shape', () => {
    const expiresAt = Date.now() + 120000;
    const quote = mapOrchestraQuoteToLightningQuote(
      {
        quoteId: 'quote_123',
        depositAddress: 'spark1deposit',
        amountIn: '2500000',
        estimatedOut: '2000',
        expiresAt,
        quoteFees: 12500,
      },
      2000,
    );

    expect(quote).toEqual(
      expect.objectContaining({
        invoiceAmountSats: 2000,
        estimatedLightningFee: 0,
        btcAmountRequired: 2000,
        tokenAmountRequired: 2500000,
        estimatedAmmFee: 12500,
        poolId: 'quote_123',
        quoteId: 'quote_123',
        depositAddress: 'spark1deposit',
        expiresAt,
        estimatedOut: '2000',
        orchestra: true,
      }),
    );
  });

  test('rejects malformed Orchestra quote responses', () => {
    expect(() =>
      mapOrchestraQuoteToLightningQuote(
        {
          quoteId: 'quote_123',
          amountIn: '2500000',
          expiresAt: Date.now() + 120000,
        },
        2000,
      ),
    ).toThrow('Missing Orchestra deposit address');
  });

  test('preserves backend error code and minimum sats', () => {
    expect(
      normalizeOrchestraBackendError(
        {
          error: {
            code: 'amount_too_small',
            message: 'Minimum is 5000 sats',
            minimumSats: '5000',
          },
        },
        'fallback',
      ),
    ).toEqual({
      code: 'amount_too_small',
      message: 'Minimum is 5000 sats',
      minimumSats: '5000',
    });
  });
});
