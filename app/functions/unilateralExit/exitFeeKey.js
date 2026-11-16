import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { sha256 } from '@noble/hashes/sha2';
import { ripemd160 } from '@noble/hashes/legacy';
import { bytesToHex } from '@noble/hashes/utils';
import { bech32 } from 'bech32';

// BIP84 mainnet index 0: the address the user funds to pay exit fees.
export function deriveExitFeeKey(mnemonic) {
  const node = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic)).derive(
    "m/84'/0'/0'/0/0",
  );
  const hash160 = ripemd160(sha256(node.publicKey));
  return {
    address: bech32.encode('bc', [0, ...bech32.toWords(hash160)]),
    publicKeyHex: bytesToHex(node.publicKey),
    secretKey: node.privateKey,
  };
}
