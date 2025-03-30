import * as bip39 from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english';

export default function isValidMnemonic(mnemonic) {
  const mnemoincToString = mnemonic.join(' ');
  try {
    const isValid = bip39.validateMnemonic(mnemoincToString, wordlist);
    if (!isValid) throw new Error('Not a valid mnemoinc');
    return true;
  } catch (err) {
    console.log('validate mnemoinc error', err);
    return false;
  }
}
