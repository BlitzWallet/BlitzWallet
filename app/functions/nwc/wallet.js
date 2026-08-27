import { loadSparkNative } from '../spark/lazySpark';
import { retrieveData } from '../secureStore';
import { NWC_SECURE_STORE_MNEMOINC } from '../../constants';
export let nwcWallet = null;

let nwcWalletViewer = null;
let nwcViewerSparkAddress = null;
let nwcViewerIdentityPublicKey = null;

export const initializeNWCWallet = async () => {
  try {
    if (nwcWallet) {
      return { isConnected: true };
    }
    const NWCMnemoinc = (await retrieveData(NWC_SECURE_STORE_MNEMOINC)).value;

    if (!NWCMnemoinc) throw new Error('No seed created');

    const { SparkWallet } = await loadSparkNative();
    const { wallet } = await SparkWallet.initialize({
      mnemonicOrSeed: NWCMnemoinc,
      options: {
        network: 'MAINNET',
        optimizationOptions: {
          multiplicity: 2,
        },
      },
    });

    console.log('Connected to new nwc wallet');
    nwcWallet = wallet;

    return { isConnected: true };
  } catch (err) {
    console.log('Initialize spark wallet error nwc', err);
    nwcWallet = null;
    return { isConnected: false, error: err.message };
  }
};

// Watch-only (readonly) client for read paths (get_balance, list_transactions).
// It answers balance/transfer queries without initializing the full SparkWallet
// (no leaf sync, no transfer claims), which is much cheaper in a background task.
export const initializeNWCWalletViewer = async () => {
  try {
    if (nwcWalletViewer) {
      return { isConnected: true };
    }
    const NWCMnemoinc = (await retrieveData(NWC_SECURE_STORE_MNEMOINC)).value;

    if (!NWCMnemoinc) throw new Error('No seed created');

    const { DefaultSparkSigner, SparkReadonlyClient, encodeSparkAddress } =
      await loadSparkNative();
    const signer = new DefaultSparkSigner();
    // MAINNET wallets live at account 1 (SparkWallet.initialize and
    // SparkReadonlyClient.createWithMasterKey both default MAINNET to 1).
    // Without this, the seed derives account 0's address — a different,
    // empty wallet — so balance/transactions come back 0/empty.
    const identityPublicKey = await signer.createSparkWalletFromSeed(
      await signer.mnemonicToSeed(NWCMnemoinc),
      1,
    );

    nwcWalletViewer = await SparkReadonlyClient.createWithMasterKey(
      {
        network: 'MAINNET',
      },
      NWCMnemoinc,
    );
    nwcViewerIdentityPublicKey = identityPublicKey;
    nwcViewerSparkAddress = encodeSparkAddress({
      identityPublicKey,
      network: 'MAINNET',
    });

    console.log(
      'Connected to nwc wallet viewer',
      nwcViewerIdentityPublicKey,
      nwcViewerSparkAddress,
    );

    return { isConnected: true };
  } catch (err) {
    console.log('Initialize spark wallet viewer error nwc', err);
    nwcWalletViewer = null;
    nwcViewerSparkAddress = null;
    nwcViewerIdentityPublicKey = null;
    return { isConnected: false, error: err.message };
  }
};

export const getNWCSparkViewerBalance = async () => {
  try {
    if (!nwcWalletViewer)
      throw new Error('spark wallet viewer not initialized');
    const balance = await nwcWalletViewer.getAvailableBalance(
      nwcViewerSparkAddress,
    );
    return { balance: Number(balance) };
  } catch (err) {
    console.log('Get spark viewer balance error', err);
    return 0;
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
    return { didWork: true, response };
  } catch (err) {
    console.log('Get spark address error', err);
    return { didWork: false, error: err.message };
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
    return { didWork: true, response };
  } catch (err) {
    console.log('Get lightning payment fee error', err);
    return { didWork: false, error: err.message };
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
    return { didWork: true, response };
  } catch (err) {
    console.log('Receive lightning payment error', err);
    return { didWork: false, error: err.message };
  }
};

export const sendNWCSparkLightningPayment = async ({ invoice, amountSats }) => {
  try {
    if (!nwcWallet) throw new Error('sparkWallet not initialized');

    const paymentResponse = await nwcWallet.payLightningInvoice({
      invoice,
      amountSatsToSend: amountSats,
    });
    return { didWork: true, paymentResponse };
  } catch (err) {
    console.log('Send lightning payment error', err);
    return { didWork: false, error: err.message };
  }
};
export const NWCSparkLightningPaymentStatus = async id => {
  try {
    if (!nwcWallet) throw new Error('sparkWallet not initialized');
    const paymentResponse = await nwcWallet.getLightningSendRequest(id);
    return { didWork: true, paymentResponse };
  } catch (err) {
    console.log('Send lightning payment error', err);
    return { didWork: false, error: err.message };
  }
};
export const getNWCLightningReceiveRequest = async lightningInvoiceId => {
  try {
    if (!nwcWallet) throw new Error('nwcWallet not initialized');
    const paymentResponse = await nwcWallet.getLightningReceiveRequest(
      lightningInvoiceId,
    );
    return { didWork: true, paymentResponse };
  } catch (err) {
    console.log('Get lightning payment status error', err);
    return { didWork: false, error: err.message };
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
    return { didWork: true, paymentResponse };
  } catch (err) {
    console.log('Send lightning payment error', err);
    return { didWork: false, error: err.message };
  }
};
