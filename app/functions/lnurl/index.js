// import {HDKey} from '@scure/bip32';
// import * as nobleSecp from '@noble/secp256k1';

// import {bytesToHex, hexToBytes} from '@noble/hashes/utils';
// import {mnemonicToSeedSync, entropyToMnemonic} from '@scure/bip39';
// import {wordlist} from '@scure/bip39/wordlists/english';

// export function getBitcoinKeyPair(mnemonic) {
//   const seed = mnemonicToSeedSync(mnemonic);

//   const root = HDKey.fromMasterSeed(seed);

//   const child = root.derive("m/44'/0'/0'/0/0");
//   const privateKey = child.privateKey;

//   const publicKey = nobleSecp.getPublicKey(privateKey, true);

//   return {
//     privateKey: bytesToHex(privateKey),
//     publicKey: bytesToHex(publicKey),
//   };
// }

// export function getSharedKey(privateKey, serverPubKey) {
//   const sharedSecret = nobleSecp.getSharedSecret(
//     hexToBytes(privateKey),
//     hexToBytes(serverPubKey),
//     true,
//   );

//   const mnemonic = entropyToMnemonic(sharedSecret.slice(0, 32), wordlist);

//   return mnemonic;
// }

export function formatLightningAddress(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    console.log(urlObj, hostname, pathname);

    const pathParts = pathname.split('/').filter(part => part !== '');
    const username = pathParts[pathParts.length - 1];

    if (!username) {
      throw new Error('Could not extract username from URL');
    }

    return `${username}@${hostname}`;
  } catch (error) {
    throw new Error(`Invalid URL or unable to parse: ${error.message}`);
  }
}
