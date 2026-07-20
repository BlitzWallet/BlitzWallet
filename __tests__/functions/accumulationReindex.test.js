import {
  REINDEX_WINDOW_MS,
  classifyReindexResponse,
  getReindexThrottle,
} from '../../app/constants/accumulationAddresses';

describe('classifyReindexResponse', () => {
  it('treats a false wrapper response as error', () => {
    expect(classifyReindexResponse(false)).toBe('error');
  });

  it('treats a backend { error } as error', () => {
    expect(classifyReindexResponse({ error: 'boom' })).toBe('error');
  });

  it('treats an errorCode/errorMessage response as error', () => {
    expect(classifyReindexResponse({ errorCode: 'X' })).toBe('error');
    expect(classifyReindexResponse({ errorMessage: 'nope' })).toBe('error');
  });

  it('reports funds when triggeredCurrencies is non-empty', () => {
    expect(
      classifyReindexResponse({ triggeredCurrencies: ['USDC'] }),
    ).toBe('funds');
  });

  it('reports no_funds when a scan ran but nothing triggered', () => {
    expect(
      classifyReindexResponse({
        checkedCurrencies: ['USDC'],
        triggeredCurrencies: [],
      }),
    ).toBe('no_funds');
  });

  it('treats an unknown shape as error', () => {
    expect(classifyReindexResponse({})).toBe('error');
  });
});

describe('getReindexThrottle', () => {
  const addr = 'addr1';
  const now = 1_000_000_000;

  it('does not throttle a never-checked address', () => {
    expect(getReindexThrottle({}, addr, now)).toEqual({
      throttled: false,
      remainingMs: 0,
    });
  });

  it('throttles within the 15m window and reports remaining time', () => {
    const last = now - 60_000; // checked 1 min ago
    const result = getReindexThrottle({ [addr]: last }, addr, now);
    expect(result.throttled).toBe(true);
    expect(result.remainingMs).toBe(REINDEX_WINDOW_MS - 60_000);
  });

  it('clears once the window has elapsed', () => {
    const last = now - REINDEX_WINDOW_MS;
    expect(getReindexThrottle({ [addr]: last }, addr, now)).toEqual({
      throttled: false,
      remainingMs: 0,
    });
  });
});
