import {
  deriveChildAuthKey,
  reserveChild,
} from '../../../app/functions/accounts/childAccounts';

const SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('deriveChildAuthKey', () => {
  it('is deterministic for the same (seed, index)', async () => {
    const a = await deriveChildAuthKey(SEED, 0);
    const b = await deriveChildAuthKey(SEED, 0);
    expect(a.authPriv).toBe(b.authPriv);
    expect(a.authPub).toBe(b.authPub);
    expect(a.authPriv).toMatch(/^[0-9a-f]{64}$/);
    expect(a.authPub).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is unique per child index (no sibling correlation)', async () => {
    const c0 = await deriveChildAuthKey(SEED, 0);
    const c1 = await deriveChildAuthKey(SEED, 1);
    expect(c0.authPub).not.toBe(c1.authPub);
  });

  it("is never the child's own spend key", async () => {
    const { childPublicKey } = await reserveChild({
      mainSeed: SEED,
      childIndex: 0,
    });
    const { authPub } = await deriveChildAuthKey(SEED, 0);
    expect(authPub).not.toBe(childPublicKey);
  });

  it('rejects invalid input', async () => {
    await expect(deriveChildAuthKey(SEED, -1)).rejects.toThrow();
    await expect(deriveChildAuthKey('', 0)).rejects.toThrow();
  });
});
