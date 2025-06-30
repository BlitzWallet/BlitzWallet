import {generateMnemonic} from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english';
import {crashlyticsLogReport} from './crashlyticsLogs';
import {IS_LETTER_REGEX} from '../constants';

export async function createAccountMnemonic() {
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
    return filtedMnemoinc;
  } catch (err) {
    console.log('generate mnemoinc error:', err);
    return false;
  }
}

export function handleRestoreFromText(seedString) {
  try {
    let wordArray = [];
    let currentIndex = 0;
    let maxIndex = seedString.length;
    let currentWord = '';

    while (currentIndex <= maxIndex) {
      const letter = seedString[currentIndex];
      const isLetter = IS_LETTER_REGEX.test(letter);
      if (!isLetter) {
        currentIndex += 1;
        continue;
      }
      currentWord += letter.toLowerCase();
      const currentTry = currentWord;

      const posibleOptins = wordlist.filter(word =>
        word.toLowerCase().startsWith(currentTry),
      );

      if (!posibleOptins.length) {
        const lastPosibleOption = currentWord.slice(0, currentWord.length - 1);
        wordArray.push(lastPosibleOption);
        currentWord = '';
        continue;
      }
      if (
        posibleOptins.length === 1 &&
        posibleOptins[0].toLowerCase() === currentTry.toLowerCase()
      ) {
        wordArray.push(currentTry);
        currentWord = '';
      }

      currentIndex += 1;
    }

    return {didWork: true, seed: wordArray};
  } catch (err) {
    console.log('handle restore from text error', err);
    return {didWork: false, error: err.message};
  }
}
