import {bytesToHex} from '@noble/hashes/utils';
import {HDKey} from '@scure/bip32';
import {mnemonicToSeedSync} from '@scure/bip39';

export function privateKeyFromSeedWords(mnemonic) {
  const root = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic));
  const privateKey = root.derive(`m/44'/1237'/0'/0/0`).privateKey;
  if (!privateKey) throw new Error('could not derive private key');
  return bytesToHex(privateKey);
}
