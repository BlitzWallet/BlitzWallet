import { bytesToHex } from '@noble/hashes/utils';
import { HDKey } from '@scure/bip32';
import { pbkdf2 } from 'react-native-quick-crypto';

export async function mnemonicToSeedAsync(mnemonic, password = '') {
  const normalized = Buffer.from(
    `mnemonic${password.normalize('NFKD')}`,
    'utf8',
  );
  const mnemonicBuffer = Buffer.from(mnemonic.normalize('NFKD'), 'utf8');

  return new Promise((resolve, reject) => {
    pbkdf2(
      mnemonicBuffer,
      normalized,
      2048,
      64,
      'sha512',
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      },
    );
  });
}

export async function privateKeyFromSeedWords(mnemonic) {
  const seed = await mnemonicToSeedAsync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const privateKey = root.derive(`m/44'/1237'/0'/0/0`).privateKey;
  if (!privateKey) throw new Error('could not derive private key');
  return bytesToHex(privateKey);
}
