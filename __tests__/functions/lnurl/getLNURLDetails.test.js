jest.mock('../../../app/functions/lnurl/bench32Formmater', () => ({
  decodeLNURL: jest.fn(() => false),
}));

import getLNURLDetails, {
  LIGHTNING_ADDRESS_REGEX,
} from '../../../app/functions/lnurl/getLNURLDetails';
import { decodeLNURL } from '../../../app/functions/lnurl/bench32Formmater';

const originalFetch = global.fetch;

describe('getLNURLDetails', () => {
  let fetchMock;

  beforeEach(() => {
    jest.clearAllMocks();
    decodeLNURL.mockReturnValue(false);
    fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ tag: 'payRequest', callback: 'https://x.com' }),
    }));
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('lightning address fallback (username@domain)', () => {
    test('fetches the LUD-16 well-known URL for a valid lightning address', async () => {
      const result = await getLNURLDetails('satoshi@example.com');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/.well-known/lnurlp/satoshi',
      );
      expect(result).toEqual({
        tag: 'payRequest',
        callback: 'https://x.com',
      });
    });

    test.each([
      '../../admin@localhost',
      '..%2f..%2fadmin@evil.com',
      'user@127.0.0.1',
      'user@10.0.0.5',
      'user@192.168.1.1',
      'user@169.254.169.254',
      'user@localhost',
      'user@intranet',
      'user@http://evil.com',
      'user@https://evil.com',
      'a@b@evil.com',
      'user@evil.com/path',
      'user@evil.com:8080',
      '@evil.com',
      // Every IPv4 encoding the URL layer canonicalizes back to a literal
      // address, plus the trailing-dot forms that dodge a label-only check.
      'user@127.0.0.1.',
      'user@2130706433.',
      'user@0x7f.0x0.0x0.0x1',
      'user@0177.0.0.1.',
      'user@169.254.169.254.',
      'user@localhost.',
      // '%' is refused deliberately: a percent sequence survives into the URL
      // path, where '%2f' re-opens the traversal above. It is not valid in a
      // LUD-16 address, so nothing legitimate is lost.
      'a%2e%2e%2fadmin@evil.com',
      'a%b@evil.com',
    ])('refuses to fetch attacker-controlled input: %s', async input => {
      const result = await getLNURLDetails(input);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    test.each([
      [
        'alice+tips@getalby.com',
        'https://getalby.com/.well-known/lnurlp/alice+tips',
      ],
      [
        'satoshi.nakamoto@example.com',
        'https://example.com/.well-known/lnurlp/satoshi.nakamoto',
      ],
      [
        'user_1-2@sub.example.co.uk',
        'https://sub.example.co.uk/.well-known/lnurlp/user_1-2',
      ],
      ['Satoshi@Example.COM', 'https://Example.COM/.well-known/lnurlp/Satoshi'],
      // Addresses the app builds itself in the phone-payment flow.
      [
        '254717252303@bitcoin.co.ke',
        'https://bitcoin.co.ke/.well-known/lnurlp/254717252303',
      ],
      [
        'user@xn--bcher-kva.example',
        'https://xn--bcher-kva.example/.well-known/lnurlp/user',
      ],
    ])('resolves the real-world address %s', async (input, expectedUrl) => {
      const result = await getLNURLDetails(input);

      expect(fetchMock).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual({ tag: 'payRequest', callback: 'https://x.com' });
    });

    test("accepts every local part the app's own address gate admits, except %", () => {
      // totalTipsScreen gates the POS payout field on EMAIL_REGEX before
      // calling this; a stricter local part here would reject an address the
      // user was already told was valid.
      const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      const localPartChars = 'abzABZ019._+-';

      for (const char of localPartChars) {
        const address = `a${char}b@example.com`;
        expect(EMAIL_REGEX.test(address)).toBe(true);
        expect(LIGHTNING_ADDRESS_REGEX.test(address)).toBe(true);
      }
    });
  });

  describe('bech32 LNURL branch', () => {
    test('fetches a valid HTTPS decoded LNURL', async () => {
      decodeLNURL.mockReturnValueOnce(
        'https://example.com/.well-known/lnurlp/x',
      );
      await getLNURLDetails('LNURLWHATEVER');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/.well-known/lnurlp/x',
      );
    });

    test('refuses non-HTTPS decoded LNURL', async () => {
      decodeLNURL.mockReturnValueOnce(
        'http://example.com/.well-known/lnurlp/x',
      );
      const result = await getLNURLDetails('LNURLWHATEVER');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
