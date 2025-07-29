import {
  SparkWallet,
  ReactNativeSparkSigner,
} from '@buildonspark/spark-sdk/native';
import {retrieveData} from '../secureStore';
import {NWC_SECURE_STORE_MNEMOINC} from '../../constants';
export let nwcWallet = null;

export const initializeNWCWallet = async () => {
  try {
    if (nwcWallet) {
      console.log('using cahced wallet', nwcWallet);
      return {isConnected: true};
    }
    const NWCMnemoinc = (await retrieveData(NWC_SECURE_STORE_MNEMOINC)).value;

    const {wallet} = await SparkWallet.initialize({
      signer: new ReactNativeSparkSigner(),
      mnemonicOrSeed: NWCMnemoinc,
      options: {network: 'MAINNET'},
    });

    console.log('Connected to new nwc wallet');
    nwcWallet = wallet;

    return {isConnected: true};
  } catch (err) {
    console.log('Initialize spark wallet error', err);
    nwcWallet = null;
    return {isConnected: false, error: err.message};
  }
};
export const getNWCSparkIdentityPubKey = async () => {
  try {
    if (!nwcWallet) throw new Error('sparkWallet not initialized');
    return await nwcWallet.getIdentityPublicKey();
  } catch (err) {
    console.log('Get spark balance error', err);
  }
};
export const getNWCSparkBalance = async () => {
  try {
    if (!nwcWallet) throw new Error('sparkWallet not initialized');
    return await nwcWallet.getBalance();
  } catch (err) {
    console.log('Get spark balance error', err);
    return 0;
  }
};
export const getNWCSparkAddress = async () => {
  try {
    if (!nwcWallet) throw new Error('sparkWallet not initialized');
    const response = await nwcWallet.getSparkAddress();
    return {didWork: true, response};
  } catch (err) {
    console.log('Get spark address error', err);
    return {didWork: false, error: err.message};
  }
};
export const getNWCSparkLightningPaymentFeeEstimate = async (
  invoice,
  amountSat,
) => {
  try {
    if (!nwcWallet) throw new Error('sparkWallet not initialized');
    const response = await nwcWallet.getLightningSendFeeEstimate({
      encodedInvoice: invoice,
      amountSats: amountSat,
    });
    return {didWork: true, response};
  } catch (err) {
    console.log('Get lightning payment fee error', err);
    return {didWork: false, error: err.message};
  }
};
export const receiveNWCSparkLightningPayment = async ({
  amountSats,
  memo,
  expirySeconds = 60 * 60 * 12,
}) => {
  try {
    if (!nwcWallet) throw new Error('sparkWallet not initialized');
    const response = await nwcWallet.createLightningInvoice({
      amountSats,
      memo,
      expirySeconds, // 12 hour invoice expiry
    });
    return {didWork: true, response};
  } catch (err) {
    console.log('Receive lightning payment error', err);
    return {didWork: false, error: err.message};
  }
};

export const sendNWCSparkLightningPayment = async ({
  invoice,
  maxFeeSats,
  amountSats,
}) => {
  try {
    if (!nwcWallet) throw new Error('sparkWallet not initialized');
    const paymentResponse = await nwcWallet.payLightningInvoice({
      invoice,
      maxFeeSats: Math.round(maxFeeSats * 1.2),
      amountSatsToSend: amountSats,
    });
    return {didWork: true, paymentResponse};
  } catch (err) {
    console.log('Send lightning payment error', err);
    return {didWork: false, error: err.message};
  }
};
export const NWCSparkLightningPaymentStatus = async id => {
  try {
    if (!nwcWallet) throw new Error('sparkWallet not initialized');
    const paymentResponse = await nwcWallet.getLightningSendRequest(id);
    return {didWork: true, paymentResponse};
  } catch (err) {
    console.log('Send lightning payment error', err);
    return {didWork: false, error: err.message};
  }
};
export const getNWCLightningReceiveRequest = async lightningInvoiceId => {
  try {
    if (!nwcWallet) throw new Error('nwcWallet not initialized');
    const paymentResponse = await nwcWallet.getLightningReceiveRequest(
      lightningInvoiceId,
    );
    return {didWork: true, paymentResponse};
  } catch (err) {
    console.log('Get lightning payment status error', err);
    return {didWork: false, error: err.message};
  }
};
export const getNWCSparkTransactions = async (
  transferCount = 100,
  offsetIndex,
) => {
  try {
    if (!nwcWallet) throw new Error('sparkWallet not initialized');
    return await nwcWallet.getTransfers(transferCount, offsetIndex);
  } catch (err) {
    console.log('get spark transactions error', err);
  }
};
export const sendNWCSparkPayment = async (amount, address) => {
  try {
    if (!nwcWallet) throw new Error('sparkWallet not initialized');
    const paymentResponse = await nwcWallet.transfer({
      receiverSparkAddress: address,
      amountSats: amount,
    });
    return {didWork: true, paymentResponse};
  } catch (err) {
    console.log('Send lightning payment error', err);
    return {didWork: false, error: err.message};
  }
};
