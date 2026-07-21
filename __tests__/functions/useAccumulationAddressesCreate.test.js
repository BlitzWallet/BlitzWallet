import { resolveCreateAddressAction } from '../../app/constants/accumulationAddresses';

describe('resolveCreateAddressAction', () => {
  it('reuses an existing address when not forcing new', () => {
    const r = resolveCreateAddressAction({
      matching: [{ depositAddress: 'a' }],
      forceNew: false,
      limit: 5,
    });
    expect(r).toEqual({ type: 'reuse', address: 'a' });
  });

  it('forceNew bypasses reuse and mints when below cap', () => {
    const r = resolveCreateAddressAction({
      matching: [{ depositAddress: 'a' }],
      forceNew: true,
      limit: 5,
    });
    expect(r).toEqual({ type: 'mint' });
  });

  it('forceNew does not bypass the cap', () => {
    const matching = Array.from({ length: 5 }, (_, i) => ({
      depositAddress: `addr${i}`,
    }));
    const r = resolveCreateAddressAction({ matching, forceNew: true, limit: 5 });
    expect(r).toEqual({ type: 'limit_reached' });
  });

  it('reuse wins over cap when matching exists without forceNew', () => {
    const matching = Array.from({ length: 5 }, (_, i) => ({
      depositAddress: `addr${i}`,
    }));
    const r = resolveCreateAddressAction({ matching, forceNew: false, limit: 5 });
    expect(r.type).toBe('reuse');
  });

  it('mints when below cap with forceNew', () => {
    const matching = Array.from({ length: 4 }, (_, i) => ({
      depositAddress: `addr${i}`,
    }));
    const r = resolveCreateAddressAction({ matching, forceNew: true, limit: 5 });
    expect(r).toEqual({ type: 'mint' });
  });

  it('mints when there is no matching address regardless of forceNew', () => {
    expect(
      resolveCreateAddressAction({ matching: [], forceNew: false, limit: 5 }),
    ).toEqual({ type: 'mint' });
    expect(
      resolveCreateAddressAction({ matching: [], forceNew: true, limit: 5 }),
    ).toEqual({ type: 'mint' });
  });
});
