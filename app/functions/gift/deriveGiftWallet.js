import { mnemonicToSeedSync, entropyToMnemonic } from '@scure/bip39';
import { english } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';

export function deriveGiftWallet(rootMnemonic, index) {
  // 1. Convert master mnemonic → seed
  const rootSeed = mnemonicToSeedSync(rootMnemonic);

  // 2. Create root HD key
  const root = HDKey.fromMasterSeed(rootSeed);

  // 3. Derive a hardened child for gifting
  // Example path: m/44'/0'/0'/0/index
  const path = `m/44'/0'/0'/0/${index}`;
  const child = root.derive(path);

  if (!child.privateKey) {
    throw new Error('Child key has no private key (check derivation path).');
  }

  // 4. Convert child private key into a deterministic mnemonic
  // (Using the private key bytes as entropy)
  const childEntropy = child.privateKey; // 32 bytes
  const childMnemonic = entropyToMnemonic(childEntropy, english);

  // 5. Derive a seed from the new mnemonic for use in your crypto wallet
  const childSeed = mnemonicToSeedSync(childMnemonic);

  return {
    pathUsed: path,
    childMnemonic,
    childSeed,
    childPrivateKey: child.privateKey,
  };
}
