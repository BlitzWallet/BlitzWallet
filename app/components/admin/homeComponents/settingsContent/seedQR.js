import {wordlist} from '@scure/bip39/wordlists/english';

export default function calculateSeedQR(mnemoinc) {
  let indexString = '';

  for (const word of mnemoinc.split(' ')) {
    const index = wordlist.indexOf(word);
    const paddedNumber = String(index).padStart(4, 0);
    indexString += paddedNumber;
  }
  return indexString;
}
