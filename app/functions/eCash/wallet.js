import {
  CashuMint,
  CashuWallet,
  CheckStateEnum,
  MeltQuoteState,
  MintQuoteState,
} from '@cashu/cashu-ts';
import {retrieveData} from '../secureStore';
import {mnemonicToSeed} from '@dreson4/react-native-quick-bip39';
import {parseInput} from '@breeztech/react-native-breez-sdk';
import {getLocalStorageItem, setLocalStorageItem} from '../localStorage';

import {BLITZ_DEFAULT_PAYMENT_DESCRIPTION} from '../../constants';
import {
  getSelectedMint,
  getSelectedMintData,
  getStoredProofs,
  incrementMintCounter,
  removeProofs,
  setMintCounter,
  storeEcashTransactions,
  storeProofs,
} from './db';
import {parseInvoice} from '@breeztech/react-native-breez-sdk-liquid';
import customUUID from '../customUUID';
import EventEmitter from 'events';
import {sumProofsValue} from './proofs';
export const ACTIVE_MINT_STORAGE_KEY = 'ACTIVE_ECASH_MINT';
export const ECASH_QUOTE_STORAGE_KEY = 'UNPAID_ECASH_QUOTES';

export const RESTORE_PROOFS_EVENT_NAME = 'RESTORING_PROOF_EVENT';
export const restoreProofsEventListener = new EventEmitter();

let eCashWallets = {};

export const initEcashWallet = async mintURL => {
  try {
    const selctingMint = mintURL ? Promise.resolve(mintURL) : getSelectedMint();
    const activeMintURL = await selctingMint;
    if (!activeMintURL) throw new Error('No selected mint to save to');
    if (eCashWallets[activeMintURL]) return eCashWallets[activeMintURL];
    const mnemonic = await retrieveData('mnemonic');
    const mint = new CashuMint(activeMintURL);
    // const keysets = (await mint.getKeySets()).keysets.filter(
    //   ks => ks.unit === 'sat',
    // );
    // const keys = (await mint.getKeys()).keysets.find(ks => ks.unit === 'sat');
    const seed = mnemonicToSeed(mnemonic);
    const wallet = new CashuWallet(mint, {
      bip39seed: Uint8Array.from(seed),
      mintInfo: await mint.getInfo(),
      unit: 'sat',
      // keysets,
      // keys,
    });

    await wallet.loadMint();

    eCashWallets[activeMintURL] = wallet;
    return wallet;
  } catch (err) {
    console.log('init ecash wallet error', err);
    return false;
  }
};
export const migrateEcashWallet = async mintURL => {
  try {
    const activeMintURL = mintURL;
    const mint = new CashuMint(activeMintURL);
    // const keysets = (await mint.getKeySets()).keysets.filter(
    //   ks => ks.unit === 'sat',
    // );

    // const keys = (await mint.getKeys()).keysets.find(ks => ks.unit === 'sat');

    const wallet = new CashuWallet(mint, {
      mintInfo: await mint.getInfo(),
      unit: 'sat',
      // keysets,
      // keys,
    });

    await wallet.loadMint();

    return wallet;
  } catch (err) {
    console.log('migrate ecash wallet error', err);
    return false;
  }
};

export const calculateEcashFees = (mintURL, proofs) => {
  try {
    const wallet = eCashWallets[mintURL];
    if (!wallet) throw new Error('No saved wallet');
    const fees = wallet.getFeesForProofs(proofs);
    return fees || 2;
  } catch (err) {
    console.log('ecash fee calculator error', err);
  }
};
// changeed from restoreProofs
export const restoreMintProofs = async mintURL => {
  const BATCH_SIZE = 200;
  const MAX_GAP = 2;
  const mnemonic = await retrieveData('mnemonic');
  try {
    const seed = mnemonicToSeed(mnemonic);
    let restoreCounter = 0;
    let restoreProgress = 0;
    restoreProofsEventListener.emit(
      RESTORE_PROOFS_EVENT_NAME,
      'Preparing restore process...',
    );

    const mint = new CashuMint(mintURL);
    const keysets = (await mint.getKeySets()).keysets;
    let restoredSomething = false;

    let totalSteps = keysets.length * MAX_GAP;
    let currentStep = 0;

    for (const keyset of keysets) {
      console.log(`Restoring keyset ${keyset.id} with unit ${keyset.unit}`);
      restoreProofsEventListener.emit(
        RESTORE_PROOFS_EVENT_NAME,
        `Restoring keyset ${keyset.id} with unit ${keyset.unit}`,
      );
      const wallet = new CashuWallet(mint, {
        bip39seed: Uint8Array.from(seed),
        unit: keyset.unit,
      });
      let start = 0;
      let emptyBatchCount = 0;
      let restoreProofs = [];
      while (emptyBatchCount < MAX_GAP) {
        console.log(`Restoring proofs ${start} to ${start + BATCH_SIZE}`);
        restoreProofsEventListener.emit(
          RESTORE_PROOFS_EVENT_NAME,
          `Restored ${restoreCounter} proofs for keyset ${keyset.id}`,
        );

        const proofs = (
          await wallet.restore(start, BATCH_SIZE, {keysetId: keyset.id})
        ).proofs;

        if (proofs.length === 0) {
          console.log(`No proofs found for keyset ${keyset.id}`);
          emptyBatchCount++;
        } else {
          console.log(
            `> Restored ${proofs.length} proofs with sum ${sumProofsValue(
              proofs,
            )}`,
          );
          restoreProofs = restoreProofs.concat(proofs);
          emptyBatchCount = 0;
          restoreCounter += proofs.length;
          totalSteps += 1;
        }

        start += BATCH_SIZE;
        currentStep++;
        restoreProgress = currentStep / totalSteps;

        restoreProofsEventListener.emit(
          RESTORE_PROOFS_EVENT_NAME,
          `Restored ${restoreCounter} proofs for keyset ${keyset.id}`,
        );
      }

      let restoredProofs = [];
      for (let i = 0; i < restoreProofs.length; i += BATCH_SIZE) {
        restoreProofsEventListener.emit(
          RESTORE_PROOFS_EVENT_NAME,
          `Checking proofs ${i} to ${i + BATCH_SIZE} for keyset ${keyset.id}`,
        );

        const checkRestoreProofs = restoreProofs.slice(i, i + BATCH_SIZE);
        const proofStates = await wallet.checkProofsStates(checkRestoreProofs);

        const spentProofs = checkRestoreProofs.filter(
          (p, idx) => proofStates[idx].state === 'SPENT',
        );
        const spentProofsSecrets = spentProofs.map(p => p.secret);
        const unspentProofs = checkRestoreProofs.filter(
          p => !spentProofsSecrets.includes(p.secret),
        );

        if (unspentProofs.length > 0) {
          console.log(
            `Found ${
              unspentProofs.length
            } unspent proofs with sum ${sumProofsValue(unspentProofs)}`,
          );

          const existingProofSecrets = await getStoredProofs(mintURL);
          const newProofs = unspentProofs.filter(
            p => !existingProofSecrets.includes(p.secret),
          );

          await storeProofs(newProofs, mintURL);
          restoredProofs = restoredProofs.concat(newProofs);
        }

        currentStep++;
        restoreProgress = currentStep / totalSteps;

        restoreProofsEventListener.emit(
          RESTORE_PROOFS_EVENT_NAME,
          `Checking proofs ${i} to ${i + BATCH_SIZE} for keyset ${keyset.id}`,
        );
      }

      const restoredAmount = sumProofsValue(restoredProofs);

      if (restoredAmount > 0) {
        console.log(`Restored ${restoredAmount} for keyset ${keyset.id}`);
        restoredSomething = true;

        restoreProofsEventListener.emit(
          RESTORE_PROOFS_EVENT_NAME,
          `Restored ${restoredAmount} for keyset ${keyset.id}`,
        );
      }
    }

    if (!restoredSomething) {
      restoreProofsEventListener.emit(
        RESTORE_PROOFS_EVENT_NAME,
        'No proofs found to restore',
      );
    }
    const finalCounter = restoreCounter;
    await setMintCounter(mintURL, finalCounter + 1);
    restoreProofsEventListener.emit(RESTORE_PROOFS_EVENT_NAME, 'end');
    return true;
  } catch (err) {
    console.error('Error restoring proofs:', err);
    restoreProofsEventListener.emit(RESTORE_PROOFS_EVENT_NAME, `error`);
    return null;
  }
};

async function getECashInvoice({amount, mintURL, descriptoin}) {
  try {
    const wallet = await initEcashWallet(mintURL);
    console.log(wallet);
    let mintQuote;
    let derivePathIndex;
    let didFindMintQuote = true;
    const runCount = 10;
    let counter = 0;

    while (didFindMintQuote && runCount > counter) {
      counter += 1;
      mintQuote = {parsedInvoie: null};
      try {
        console.log('ecash invioce run count', counter);
        mintQuote = await wallet.createMintQuote(
          amount,
          descriptoin || BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
        );

        const didMint = await mintEcash({
          invoice: mintQuote.request,
          quote: mintQuote.quote,
          mintURL: mintURL,
        });

        if (didMint.parsedInvoie || didMint.error === 'Quote not paid') {
          derivePathIndex = didMint.counter;
          break;
        }
        await new Promise(res => setTimeout(res, 500));
      } catch (err) {
        console.log('getEcash while loop error', err);
        break;
      }
    }

    await hanleEcashQuoteStorage(mintQuote, true, derivePathIndex);

    console.log('generated Ecash quote', mintQuote);
    return {mintQuote, counter: derivePathIndex, mintURL};
  } catch (err) {
    console.log('generating ecash invoice error', err);
    return false;
  }
}

export const hanleEcashQuoteStorage = async (mintQuote, addProof, counter) => {
  try {
    const activeMintURL = await getSelectedMint();
    if (!activeMintURL) throw new Error('No selected mint to save to');

    let localStoredQuotes =
      JSON.parse(await getLocalStorageItem(ECASH_QUOTE_STORAGE_KEY)) || [];

    if (addProof) {
      localStoredQuotes.push({...mintQuote, mintURL: activeMintURL, counter});
    } else {
      localStoredQuotes = localStoredQuotes.filter(
        quote => quote.quote !== mintQuote,
      );
    }

    await setLocalStorageItem(
      ECASH_QUOTE_STORAGE_KEY,
      JSON.stringify(localStoredQuotes),
    );
  } catch (err) {
    console.log('handle ecash quotes error', err);
  }
};

export const getEcashBalance = async () => {
  try {
    const activeMintURL = await getSelectedMint();
    if (!activeMintURL) throw new Error('No selected mint to save to');
    const savedProofs = await getStoredProofs(activeMintURL);
    console.log(savedProofs, 'saved proofs');
    if (!savedProofs) return 0;
    const userBalance = savedProofs.reduce((prev, curr) => {
      const proof = curr;
      return (prev += proof.amount);
    }, 0);
    return userBalance;
  } catch (err) {
    console.log('Get ecash balance error', err);
    return false;
  }
};

async function claimUnclaimedEcashQuotes() {
  try {
    let localStoredQuotes =
      JSON.parse(await getLocalStorageItem(ECASH_QUOTE_STORAGE_KEY)) || [];

    console.log(localStoredQuotes, 'STORED ECASH QUOTES');
    let newTransactions = {};
    let newProofs = {};
    const newQuotes = await Promise.all(
      localStoredQuotes.map(async storedQuoteInformation => {
        console.log(storedQuoteInformation?.mintURL);
        if (!storedQuoteInformation?.mintURL || !storedQuoteInformation.counter)
          return false;
        const minQuoteResponse = await checkMintQuote({
          quote: storedQuoteInformation.quote,
          mintURL: storedQuoteInformation.mintURL,
        });

        if (!minQuoteResponse) return false;

        const quoteDate = new Date(minQuoteResponse.expiry * 1000);
        const currentDate = new Date();

        if (minQuoteResponse.state === MintQuoteState.UNPAID)
          return quoteDate < currentDate ? false : minQuoteResponse;

        const didMint = await mintEcash({
          invoice: minQuoteResponse.request,
          quote: minQuoteResponse.quote,
          mintURL: storedQuoteInformation.mintURL,
          globalCounter: storedQuoteInformation.counter,
        });
        if (didMint.parsedInvoie) {
          const formattedEcashTx = formatEcashTx({
            amount: didMint.parsedInvoie.invoice.amountMsat / 1000,
            fee: 0,
            paymentType: 'received',
          });

          if (!newTransactions[storedQuoteInformation?.mintURL]) {
            newTransactions[storedQuoteInformation?.mintURL] = [];
          }
          newTransactions[storedQuoteInformation?.mintURL].push(
            formattedEcashTx,
          );

          if (!newProofs[storedQuoteInformation?.mintURL]) {
            newProofs[storedQuoteInformation?.mintURL] = [];
          }
          newProofs[storedQuoteInformation?.mintURL].push(...didMint.proofs);
          return false;
        } else {
          if (
            minQuoteResponse.state === MintQuoteState.PAID ||
            minQuoteResponse.state === MintQuoteState.ISSUED
          )
            return false;

          return minQuoteResponse;
        }
      }),
    );
    const filterdQuotes = newQuotes.filter(item => !!item);

    setLocalStorageItem(ECASH_QUOTE_STORAGE_KEY, JSON.stringify(filterdQuotes));

    if (!Object.keys(newTransactions).length && !Object.keys(newProofs).length)
      return;
    for (const mintURL in newTransactions) {
      if (newTransactions[mintURL].length) {
        await storeEcashTransactions(newTransactions[mintURL], mintURL);
      }
    }

    for (const mintURL in newProofs) {
      if (newProofs[mintURL].length) {
        await storeProofs(newProofs[mintURL], mintURL);
      }
    }
  } catch (err) {
    console.log('claim unclaimed ecash quotes err', err);
  }
}

async function mintEcash({invoice, quote, mintURL, globalCounter}) {
  let counter = 0;
  try {
    const mint = mintURL ? Promise.resolve(mintURL) : getSelectedMint();
    const currentMint = await mint;
    if (!currentMint) throw new Error('No selected mint');
    const wallet = await initEcashWallet(currentMint);
    const selctingCounter = globalCounter
      ? Promise.resolve(globalCounter)
      : incrementMintCounter(currentMint);
    counter = await selctingCounter;
    const prasedInvoice = await parseInput(invoice);
    console.log(prasedInvoice.invoice.amountMsat, 'mint ecash amount');
    console.log(counter, 'ECASH COUNTER');

    const info = await wallet.mintProofs(
      prasedInvoice.invoice.amountMsat / 1000,
      quote,
      {counter},
    );

    console.log(info, 'TESTING');

    return {parsedInvoie: prasedInvoice, proofs: info, counter};
  } catch (err) {
    console.log(err, 'mint Ecash error');
    if (err.message === 'quote not paid') {
      console.log('The quote has not been paid. Handling this specific error.');
      return {parsedInvoice: null, error: 'Quote not paid', counter};
    }

    // If other errors occur, you can handle them here:
    return {parsedInvoice: null, error: err.message, counter};
  }
}
export const checkMintQuote = async ({quote, mintURL}) => {
  try {
    const mint = mintURL ? Promise.resolve(mintURL) : getSelectedMint();
    const currentMint = await mint;
    if (!currentMint) throw new Error('No selected mint');
    const wallet = await initEcashWallet(currentMint);
    const mintQuote = await wallet.checkMintQuote(quote);
    console.log(mintQuote, 'mint quote');
    return mintQuote;
  } catch (err) {
    console.log(err, 'CHECK MINT QUOTE ERROR');
    return false;
  }
};

export async function cleanEcashWalletState(mintURL) {
  try {
    const storedProofs = await getStoredProofs(mintURL);
    const wallet = await initEcashWallet(mintURL);

    const proofsState = await wallet.checkProofsStates(storedProofs);

    const spendProofs = proofsState.filter(proof => {
      return proof.state === CheckStateEnum.SPENT;
    });
    await removeProofs(spendProofs);
    return true;
  } catch (err) {
    console.log('clean wallet state error', err);
    return false;
  }
}

export const getMeltQuote = async bolt11Invoice => {
  try {
    const mintURL = await getSelectedMint();
    if (!mintURL) throw new Error('No seleected mint url');
    const wallet = await initEcashWallet(mintURL);
    const storedProofs = await getStoredProofs(mintURL);
    const meltQuote = await wallet.createMeltQuote(bolt11Invoice);
    const {proofsToUse} = getProofsToUse(
      storedProofs,
      meltQuote.amount + meltQuote.fee_reserve,
      'desc',
    );
    return {quote: meltQuote, proofsToUse};
  } catch (err) {
    console.log('Error creating melt quote', err);
    return false;
  }
};

function formatEcashTx({amount, paymentType, fee, preImage, time}) {
  let txObject = {
    id: customUUID(),
    time: new Date().getTime(),
    amount: null,
    type: 'ecash',
    paymentType: null,
    fee: null,
    preImage: null,
  };
  txObject['amount'] = amount;
  if (time) {
    txObject['time'] = time;
  }
  txObject['paymentType'] = paymentType;
  txObject['fee'] = fee;
  txObject['preImage'] = preImage;

  return txObject;
}

export const getProofsToUse = (proofsAvailable, amount, order = 'desc') => {
  try {
    const proofsToSend = [];
    let amountAvailable = 0;
    if (order === 'desc') {
      proofsAvailable.sort((a, b) => b.amount - a.amount);
    } else {
      proofsAvailable.sort((a, b) => a.amount - b.amount);
    }

    proofsAvailable.forEach(proof => {
      if (amountAvailable >= amount) {
        return;
      }

      amountAvailable = amountAvailable + proof.amount;

      proofsToSend.push(proof);
    });
    return {proofsToUse: proofsToSend};
  } catch (err) {
    console.log('Getting proofs to use error', err);
  }
};

export const payLnInvoiceFromEcash = async ({quote, invoice, proofsToUse}) => {
  const mintURL = await getSelectedMint();
  const wallet = await initEcashWallet(mintURL);
  let proofs = [...proofsToUse];
  let returnChangeGlobal = [];
  const decodedInvoice = await parseInvoice(invoice);
  const amount = decodedInvoice.amountMsat / 1000;
  console.log('ecash quote fee reserve:', quote?.fee_reserve);
  const amountToPay = quote?.fee_reserve + amount;
  const totalProofsValue = sumProofsValue(proofs);
  console.log('Proofs before send', proofs);
  console.log(totalProofsValue, amountToPay);
  try {
    if (totalProofsValue < amountToPay)
      throw new Error('Not enough funds to cover payment');
    console.log('[payLnInvoce] use send ', {
      amountToPay,
      amount,
      fee: quote?.fee_reserve,
      proofs: totalProofsValue,
    });

    await incrementMintCounter(mintURL);
    const {proofsToSend, proofsToKeep} = await getSpendingProofs(
      amountToPay,
      proofsToUse,
      mintURL,
      wallet,
    );

    if (proofsToKeep.length) await storeProofs(proofsToKeep, mintURL);

    proofs = proofsToSend;

    let meltResponse = null;
    await incrementMintCounter(mintURL);
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const mintData = await getSelectedMintData();
        meltResponse = await wallet.meltProofs(quote, proofs, {
          counter: mintData.counter,
        });
        break;
      } catch (err) {
        meltResponse = null;
        if (err.message === 'not enough inputs provided for melt') {
          throw new Error('Insufficient balance');
        }
        if (err.message.includes('outputs have already been signed before')) {
          await incrementMintCounter(mintURL);
        }
        if (attempt === 9) {
          throw new Error('Max retry attempts reached');
        }
        await new Promise(res => setTimeout(res, 1000));
        console.log('Error in melt process, retrying...', err);
      }
    }

    if (meltResponse.quote.state != MeltQuoteState.PAID) {
      throw new Error('Invoice not paid.');
    }

    if (meltResponse?.change != null) {
      returnChangeGlobal.push(...meltResponse.change);
    }

    const realFee = Math.max(
      0,
      meltResponse.quote?.fee_reserve - sumProofsValue(meltResponse?.change),
    );

    const txObject = {
      amount: meltResponse.quote.amount,
      fee: realFee,
      paymentType: 'sent',
      preImage: meltResponse.quote.payment_preimage,
    };
    await removeProofs(proofsToUse);
    await storeProofs(returnChangeGlobal);
    await storeEcashTransactions([formatEcashTx(txObject)]);
    return {didWork: true, txObject};
  } catch (err) {
    console.log('paying ln invoice from ecash error', err);
    const mintQuote = await wallet.checkMeltQuote(quote.quote);
    if (
      mintQuote.state == MeltQuoteState.PAID ||
      mintQuote.state == MeltQuoteState.PENDING
    ) {
      return {didWork: false, message: 'Invoice already paid or pending.'};
    }
    await removeProofs(proofsToUse);
    await storeProofs([...returnChangeGlobal, ...proofs]);
    return {didWork: false, message: String(err.message)};
  }
};
async function getSpendingProofs(amountToPay, proofs, mintURL, wallet) {
  for (let runCount = 0; runCount < 10; runCount++) {
    try {
      const mintData = await getSelectedMintData();
      const {keep: proofsToKeep, send: proofsToSend} = await wallet.send(
        amountToPay,
        proofs,
        {
          counter: mintData.counter,
          includeFees: true,
        },
      );

      console.log('PROOFS TO KEEP:', proofsToKeep);
      console.log('PROOFS TO SEND:', proofsToSend);

      await incrementMintCounter(
        mintURL,
        proofsToKeep?.length + proofsToSend.length,
      );

      return {proofsToSend, proofsToKeep};
    } catch (err) {
      console.error('Error in getSpendingProofs:', err);
      if (err.message.includes('outputs have already been signed before')) {
        await incrementMintCounter(mintURL);
      }
      if (runCount === 9) {
        throw new Error('Max retry attempts reached');
      }
    }
  }
}

export {getECashInvoice, mintEcash, claimUnclaimedEcashQuotes, formatEcashTx};
