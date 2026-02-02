import {
  entropyToMnemonic,
  generateMnemonic,
  mnemonicToSeedSync,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { crashlyticsLogReport } from './crashlyticsLogs';
import { IS_LETTER_REGEX } from '../constants';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedAsync } from './nostrCompatability';

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

    while (currentIndex < maxIndex && wordArray.length < 12) {
      // Changed to < 12 since we want exactly 12 words
      // Early break if we've processed too many characters without finding any words
      if (currentIndex > 20 && wordArray.length === 0) {
        break;
      }
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
        let backtrackWord = currentWord.slice(0, currentWord.length - 1);
        let backtrackAmount = 1;

        while (
          backtrackWord &&
          !wordlist.find(
            word => word.toLowerCase() === backtrackWord.toLowerCase(),
          )
        ) {
          backtrackAmount++;
          backtrackWord = currentWord.slice(
            0,
            currentWord.length - backtrackAmount,
          );
        }

        if (!backtrackWord) {
          currentIndex += 1;
          continue;
        }
        wordArray.push(backtrackWord);
        currentWord = '';
        currentIndex -= backtrackAmount - 1;
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

    // Handle any remaining word after loop ends
    if (currentWord && wordArray.length < 12) {
      const matchingWord = wordlist.find(
        word => word.toLowerCase() === currentWord.toLowerCase(),
      );
      if (matchingWord) {
        wordArray.push(currentWord);
      }
    }

    return { didWork: true, seed: wordArray };
  } catch (err) {
    console.log('handle restore from text error', err);
    return { didWork: false, error: err.message };
  }
}
export async function deriveKeyFromMnemonic(mnemonic, index = 0) {
  try {
    const derivationPath = `m/44'/0'/0'/0/${index}`;

    const seed = await mnemonicToSeedAsync(mnemonic);

    const masterKey = HDKey.fromMasterSeed(seed);

    const childKey = masterKey.derive(derivationPath);

    const entropy128 = childKey.privateKey.slice(0, 16);
    const derivedMnemonic = entropyToMnemonic(entropy128, wordlist);

    return {
      success: true,
      privateKey: childKey.privateKey,
      publicKey: childKey.publicKey,
      chainCode: childKey.chainCode,
      depth: childKey.depth,
      index: childKey.index,
      parentFingerprint: childKey.parentFingerprint,
      derivationPath: derivationPath,
      derivedMnemonic, // Fixed typo from derivedMnemoinc
    };
  } catch (err) {
    console.log('derive key error:', err);
    return { success: false, error: err.message };
  }
}
