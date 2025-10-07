import { crashlyticsLogReport } from '../crashlyticsLogs';
import { sparkPaymenWrapper } from '../spark/payments';

export default async function sendStorePayment({
  invoice, // Bolt11 invoice
  masterInfoObject,
  sendingAmountSats,
  paymentType = 'lightning',
  description = '', //only for spark or bitcoin txs
  fee = 1,
  userBalance,
  sparkInformation,
  currentWalletMnemoinc,
  sendWebViewRequest,
}) {
  try {
    crashlyticsLogReport('Begining store payment process');

    const response = await sparkPaymenWrapper({
      address: invoice,
      paymentType: paymentType,
      amountSats: sendingAmountSats,
      masterInfoObject,
      fee,
      memo: description,
      userBalance,
      sparkInformation,
      mnemonic: currentWalletMnemoinc,
      sendWebViewRequest,
    });
    if (!response.didWork) throw new Error(response.error);
    return response;
  } catch (err) {
    console.log('Send store payment error:', err.message);
    return { didWork: false, reason: err.message };
  }
}
