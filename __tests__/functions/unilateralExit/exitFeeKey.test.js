import { deriveExitFeeKey } from '../../../app/functions/unilateralExit/exitFeeKey';

describe('deriveExitFeeKey', () => {
  it('matches the BIP84 test vector', () => {
    const key = deriveExitFeeKey(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    );
    expect(key.address).toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
    expect(key.publicKeyHex).toBe(
      '0330d54fd0dd420a6e5f8d3624f5f3482cae350f79d5f0753bf5beef9c2d91af3c',
    );
    expect(key.secretKey).toBeInstanceOf(Uint8Array);
    expect(key.secretKey.length).toBe(32);
  });
});
