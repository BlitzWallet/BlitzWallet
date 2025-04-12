import {
  CashuMint,
  CashuWallet,
  CheckStateEnum,
  MeltQuoteState,
  MintQuoteState,
} from '@cashu/cashu-ts';
import {retrieveData} from '../secureStore';
import {mnemonicToSeed} from '@scure/bip39';
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

import {sumProofsValue} from './proofs';
export const ACTIVE_MINT_STORAGE_KEY = 'ACTIVE_ECASH_MINT';
export const ECASH_QUOTE_STORAGE_KEY = 'UNPAID_ECASH_QUOTES';

let eCashWallets = {};

export const initEcashWallet = async mintURL => {
  try {
    const selctingMint = mintURL ? Promise.resolve(mintURL) : getSelectedMint();
    const activeMintURL = await selctingMint;
    if (!activeMintURL) throw new Error('No selected mint to save to');
    if (eCashWallets[activeMintURL]) return eCashWallets[activeMintURL];
    const mnemonic = await retrieveData('mnemonic');
    const mint = new CashuMint(activeMintURL);
    const keysets = (await mint.getKeySets()).keysets.filter(
      ks => ks.unit === 'sat',
    );
    const keys = (await mint.getKeys()).keysets.find(ks => ks.unit === 'sat');
    const seed = await mnemonicToSeed(mnemonic);
    const wallet = new CashuWallet(mint, {
      bip39seed: Uint8Array.from(seed),
      mintInfo: await mint.getInfo(),
      unit: 'sat',
      keysets,
      keys,
    });

    await wallet.loadMint();
    await wallet.getKeys();

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
    const keysets = (await mint.getKeySets()).keysets.filter(
      ks => ks.unit === 'sat',
    );
    const keys = (await mint.getKeys()).keysets.find(ks => ks.unit === 'sat');

    const wallet = new CashuWallet(mint, {
      mintInfo: await mint.getInfo(),
      unit: 'sat',
      keysets,
      keys,
    });

    await wallet.loadMint();

    return {wallet, didWork: true};
  } catch (err) {
    console.log('migrate ecash wallet error', err);
    return {didWork: false, reason: err.message};
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
    return 2;
  }
};

async function getECashInvoice({amount, mintURL, descriptoin}) {
  try {
    const wallet = await initEcashWallet(mintURL);
    if (!wallet)
      throw new Error('Not able to connect to your selected eCash mint.');

    const mintQuote = await wallet.createMintQuote(
      amount,
      descriptoin || BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
    );

    await hanleEcashQuoteStorage(mintQuote, true);

    console.log('generated Ecash quote', mintQuote);
    return {mintQuote, mintURL, didWork: true};
  } catch (err) {
    console.log('generating ecash invoice error', err.message);
    return {didWork: false, reason: err.message};
  }
}

export const hanleEcashQuoteStorage = async (mintQuote, addProof) => {
  try {
    const activeMintURL = await getSelectedMint();
    if (!activeMintURL) throw new Error('No selected mint to save to');

    let localStoredQuotes =
      JSON.parse(await getLocalStorageItem(ECASH_QUOTE_STORAGE_KEY)) || [];

    if (addProof) {
      localStoredQuotes.push({...mintQuote, mintURL: activeMintURL});
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
    if (!savedProofs.length) return 0;
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
    const localStoredQuotes =
      JSON.parse(await getLocalStorageItem(ECASH_QUOTE_STORAGE_KEY)) || [];

    if (!localStoredQuotes.length) return;

    console.log('STORED ECASH QUOTES', localStoredQuotes);

    const newTransactions = {};
    const newProofs = {};
    const validQuotes = [];

    for (const storedQuoteInformation of localStoredQuotes) {
      if (!storedQuoteInformation?.mintURL) continue;

      try {
        const mintURL = storedQuoteInformation.mintURL;
        const minQuoteResponse = await checkMintQuote({
          quote: storedQuoteInformation.quote,
          mintURL,
        });

        console.log('store ecash min quote response', minQuoteResponse);

        if (!minQuoteResponse) {
          validQuotes.push(storedQuoteInformation);
          continue;
        }

        const newStorageQuoteObject = {
          ...storedQuoteInformation,
          paid: minQuoteResponse.paid,
          state: minQuoteResponse.state,
        };

        if (newStorageQuoteObject.state === MintQuoteState.UNPAID) {
          if (newStorageQuoteObject.expiry) {
            const quoteDate = new Date(newStorageQuoteObject.expiry * 1000);
            const currentDate = new Date();

            if (quoteDate > currentDate) {
              validQuotes.push(newStorageQuoteObject);
            }
          } else validQuotes.push(newStorageQuoteObject);
          continue;
        }

        const didMint = await mintEcash({
          invoice: newStorageQuoteObject.request,
          quote: newStorageQuoteObject.quote,
          mintURL,
        });

        if (didMint.prasedInvoice) {
          const formattedEcashTx = formatEcashTx({
            amount: didMint.prasedInvoice.amountMsat / 1000,
            fee: 0,
            paymentType: 'received',
            description: didMint.prasedInvoice.description,
            invoice: newStorageQuoteObject.request,
          });

          newTransactions[mintURL] = newTransactions[mintURL] || [];
          newProofs[mintURL] = newProofs[mintURL] || [];

          newTransactions[mintURL].push(formattedEcashTx);
          newProofs[mintURL].push(...didMint.proofs);
        } else if (
          newStorageQuoteObject.state !== MintQuoteState.PAID &&
          newStorageQuoteObject.state !== MintQuoteState.ISSUED
        ) {
          validQuotes.push(newStorageQuoteObject);
        }
      } catch (quoteError) {
        console.log('Error processing quote:', quoteError);
        validQuotes.push(storedQuoteInformation);
      }
    }

    await setLocalStorageItem(
      ECASH_QUOTE_STORAGE_KEY,
      JSON.stringify(validQuotes),
    );

    const mintURLs = new Set([
      ...Object.keys(newTransactions),
      ...Object.keys(newProofs),
    ]);
    for (const mintURL of mintURLs) {
      const transactions = newTransactions[mintURL] || [];
      const proofs = newProofs[mintURL] || [];

      if (transactions.length) {
        await storeEcashTransactions(transactions, mintURL);
      }

      if (proofs.length) {
        await storeProofs(proofs, mintURL);
      }
    }
  } catch (err) {
    console.log('claim unclaimed ecash quotes err', err);
  }
}

async function mintEcash({invoice, quote, mintURL}) {
  let counter = 0;
  try {
    const mint = mintURL ? Promise.resolve(mintURL) : getSelectedMint();
    const currentMint = await mint;
    if (!currentMint) throw new Error('No selected mint');
    const wallet = await initEcashWallet(currentMint);
    const counter = await incrementMintCounter(currentMint);
    const prasedInvoice = await parseInvoice(invoice);

    console.log(prasedInvoice.amountMsat, 'mint ecash amount');

    const info = await wallet.mintProofs(
      prasedInvoice.amountMsat / 1000,
      quote,
      {counter},
    );
    if (info.length) await incrementMintCounter(currentMint, info.length + 1);

    return {prasedInvoice, proofs: info, counter};
  } catch (err) {
    console.log(err, 'mint Ecash error');
    if (err.message === 'quote not paid') {
      console.log('The quote has not been paid. Handling this specific error.');
      return {prasedInvoice: null, error: 'Quote not paid', counter};
    }
    // If other errors occur, you can handle them here:
    return {prasedInvoice: null, error: err.message, counter};
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
    return {quote: null, reason: err.message};
  }
};

function formatEcashTx({
  amount,
  paymentType,
  fee,
  preImage,
  time,
  description = '',
  invoice = '',
}) {
  let txObject = {
    id: customUUID(),
    time: new Date().getTime(),
    description: '',
    amount: null,
    type: 'ecash',
    paymentType: null,
    fee: null,
    preImage: null,
    invoice: '',
  };
  txObject['amount'] = amount;
  if (time) {
    txObject['time'] = time;
  }
  txObject['description'] = description;
  txObject['paymentType'] = paymentType;
  txObject['fee'] = fee;
  txObject['preImage'] = preImage;
  txObject['invoice'] = invoice;

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

export const payLnInvoiceFromEcash = async ({
  quote,
  invoice,
  proofsToUse,
  description = '',
}) => {
  const mintURL = await getSelectedMint();
  const wallet = await initEcashWallet(mintURL);
  if (!wallet)
    return {
      didWork: false,
      message: String('Not able to connect to your selected eCash mint'),
    };
  let proofs = JSON.parse(JSON.stringify(proofsToUse));
  const decodedInvoice = await parseInvoice(invoice);
  const amount = decodedInvoice.amountMsat / 1000;

  const amountToPay = quote?.fee_reserve + amount;
  const totalProofsValue = sumProofsValue(proofs);
  console.log('ecash quote fee reserve:', quote?.fee_reserve);
  console.log('Proofs before send', proofs);
  console.log(totalProofsValue, amountToPay);
  let deterministicSecretCounter = null;
  try {
    if (totalProofsValue < amountToPay)
      throw new Error('Not enough funds to cover payment');
    console.log('[payLnInvoce] use send ', {
      amountToPay,
      amount,
      fee: quote?.fee_reserve,
      proofs: totalProofsValue,
    });

    const selctingCounter = await incrementMintCounter(mintURL);

    const {proofsToSend, proofsToKeep, newCounterValue} =
      await getSpendingProofsWithPreciseCounter(
        wallet,
        amountToPay,
        proofs,
        selctingCounter,
      );

    deterministicSecretCounter = newCounterValue;

    console.log('PROOFS TO SEND LENGTH:', proofsToSend.length);
    console.log('PROOFS TO KEEP LENGTH:', proofsToKeep.length);

    proofs = proofsToSend;

    if (proofsToKeep.length) await storeProofs(proofsToKeep, mintURL);

    let meltResponse = await wallet.meltProofs(quote, proofsToSend, {
      counter: newCounterValue,
    });
    console.log('melt response', meltResponse);

    if (meltResponse?.change?.length) {
      await setMintCounter(
        mintURL,
        newCounterValue + meltResponse.change.length + 1,
      );
      deterministicSecretCounter += meltResponse.change.length + 1;
      await storeProofs(meltResponse.change, mintURL);
    } else {
      await setMintCounter(mintURL, newCounterValue + 1);
      deterministicSecretCounter += 1;
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
      description: decodedInvoice?.description || description,
      invoice: invoice,
    };

    await removeProofs(proofsToUse);
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
    await storeProofs(proofs);
    deterministicSecretCounter &&
      (await setMintCounter(mintURL, deterministicSecretCounter + 1));
    return {didWork: false, message: String(err.message)};
  }
};

const getSpendingProofsWithPreciseCounter = async (
  wallet,
  amountToPay,
  proofs,
  currentCounter,
) => {
  try {
    const {keep: proofsToKeep, send: proofsToSend} = await wallet.send(
      amountToPay,
      proofs,
      {
        counter: currentCounter,
        includeFees: true,
      },
    );

    const existingProofsIds = proofs.map(p => p.secret);
    const newKeepProofsCount = proofsToKeep.filter(
      p => !existingProofsIds.includes(p.secret),
    ).length;
    const newSendProofsCount = proofsToSend.filter(
      p => !existingProofsIds.includes(p.secret),
    ).length;

    console.log(newKeepProofsCount, 'NEW PROOFS KEEP COUNT s');
    console.log(newSendProofsCount, 'NEW PROOFS SEND COUNT s');

    const newCounterValue =
      currentCounter + newKeepProofsCount + newSendProofsCount;

    return {
      proofsToSend,
      proofsToKeep,
      newCounterValue,
    };
  } catch (err) {
    console.error('Error in getSpendingProofsWithPreciseCounter:', err);
    throw err;
  }
};

export {getECashInvoice, mintEcash, claimUnclaimedEcashQuotes, formatEcashTx};
