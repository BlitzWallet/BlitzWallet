/* eslint-env jest */
import { assignLnurlId } from '../../../app/functions/accounts/assignLnurlId';

describe('assignLnurlId', () => {
  test('uses the 4-char prefix by default (lowercased)', () => {
    expect(assignLnurlId('ABCD1234ef', {})).toBe('abcd');
  });

  test('extends the prefix on collision', () => {
    expect(assignLnurlId('abcd1234', { abcd: {} })).toBe('abcd1');
  });

  test('skips the reserved currency suffix, growing past it', () => {
    // len4 'd60f' + len5 'd60fb' taken → len6 'd60fbd' is reserved → 'd60fbde'
    expect(assignLnurlId('d60fbdef1234', { d60f: {}, d60fb: {} })).toBe(
      'd60fbde',
    );
  });

  test('distinct pubkeys sharing a prefix never collide', () => {
    const map = {};
    const a = assignLnurlId('deadbeef00', map);
    map[a] = { uuid: 'a' };
    const b = assignLnurlId('deadbeef11', map);
    map[b] = { uuid: 'b' };
    expect(a).not.toBe(b);
    expect('deadbeef00'.startsWith(a)).toBe(true);
    expect('deadbeef11'.startsWith(b)).toBe(true);
  });
});
