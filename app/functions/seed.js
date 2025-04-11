import {storeData} from './secureStore';
import {generateMnemonic} from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english';
import {crashlyticsLogReport} from './crashlyticsLogs';

export default async function createAccountMnemonic() {
  try {
    crashlyticsLogReport('Starting generting account mnemoinc');
    let generatedMnemonic = generateMnemonic(wordlist);
    const unuiqueKeys = new Set(generatedMnemonic.split(' '));

    if (unuiqueKeys.size !== 12) {
      let runCount = 0;
      let didFindValidMnemoinc = false;
      while (runCount < 50 && !didFindValidMnemoinc) {
        console.log(`Running retry for account mnemoinc count: ${runCount}`);
        runCount += 1;
        const newTry = generateMnemonic(wordlist);
        const uniqueItems = new Set(newTry.split(' '));
        if (uniqueItems.size != 12) continue;
        didFindValidMnemoinc = true;
        generatedMnemonic = newTry;
      }
    }

    const filtedMnemoinc = generatedMnemonic
      .split(' ')
      .filter(word => word.length > 2)
      .join(' ');
    await storeData('mnemonic', generatedMnemonic);
    return filtedMnemoinc;
  } catch (err) {
    console.log('generate mnemoinc error:', err);
    return false;
  }
}
