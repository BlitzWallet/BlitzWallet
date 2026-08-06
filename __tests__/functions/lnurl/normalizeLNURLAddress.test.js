import { bech32 } from 'bech32';
import normalizeLNURLAddress from '../../../app/functions/lnurl/normalizeLNURLAddress';

function encodeLNURL(url) {
  return bech32
    .encode('lnurl', bech32.toWords(Buffer.from(url, 'utf8')), 2000)
    .toUpperCase();
}

describe('normalizeLNURLAddress', () => {
  test('rejects LNURLs that decode to a non-HTTPS URL', () => {
    const lnurl = encodeLNURL('http://blitzwalletapp.com/victim');
    expect(normalizeLNURLAddress(lnurl)).toBeNull();
  });

  test('does not mint a recipient identity from an untrusted decoded hostname', () => {
    const attackerHost = encodeLNURL('https://blitzwalletapp.com.evil.example/pay');
    const attackerHost2 = encodeLNURL('https://attacker.example.com/payme');
    expect(normalizeLNURLAddress(attackerHost)).toBeNull();
    expect(normalizeLNURLAddress(attackerHost2)).toBeNull();
  });

  test('formats a trusted https Blitz LNURL into a lightning address', () => {
    const lnurl = encodeLNURL('https://blitzwalletapp.com/p/alice');
    expect(normalizeLNURLAddress(lnurl)).toBe('alice@blitzwalletapp.com');
  });

  test('passes through non-LNURL addresses unchanged', () => {
    expect(normalizeLNURLAddress('alice@blitzwalletapp.com')).toBe(
      'alice@blitzwalletapp.com',
    );
    expect(normalizeLNURLAddress(null)).toBeNull();
    expect(normalizeLNURLAddress(undefined)).toBeNull();
  });
});
