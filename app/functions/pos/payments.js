import { InputTypes } from 'bitcoin-address-parser';
import { getLNAddressForLiquidPayment } from '../../components/admin/homeComponents/sendBitcoin/functions/payments';
import getLNURLDetails from '../lnurl/getLNURLDetails';
import { sparkPaymenWrapper } from '../spark/payments';
// import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';

/**
 * Pay to a Lightning address using the most efficient available payment method
/**
 * Pay to a Lightning address using the most efficient available payment method
 * @param {Object} params - Payment parameters
 * @param {string} params.LNURLAddress - Lightning address to pay to
 * @param {number} params.sendingAmountSats - Amount to send in satoshis
 * @param {Object} params.masterInfoObject - Master information object
 * @param {string} params.description - Payment description
 * @param {Object} params.sparkInformation - Information about the spark context including balance
 * @param {Object} params.currentWalletMnemoinc - Admin wallets mnemoinc
 * @returns {Promise<boolean>} - True if payment successful, false otherwise
 */
export async function payPOSLNURL({
  LNURLAddress, // LNURL address
  sendingAmountSats,
  masterInfoObject,
  description,
  sparkInformation,
  currentWalletMnemoinc,
  sendWebViewRequest,
}) {
  try {
    // Parse the LNURL address first as it's needed for all payment methods

    const didGetData = await getLNURLDetails(LNURLAddress);
    if (!didGetData) throw new Error('Unable to get lnurl data');
    const parsedInput = { type: InputTypes.LNURL_PAY, data: didGetData };

    const invoice = await getLNAddressForLiquidPayment(
      parsedInput,
      sendingAmountSats,
      description,
    );

    if (!invoice) throw new Error('Not able to get invoice');

    const feeResponse = await sparkPaymenWrapper({
      getFee: true,
      address: invoice,
      paymentType: 'lightning',
      amountSats: sendingAmountSats,
      masterInfoObject,
      fee: 0,
      description: '',
      mnemonic: currentWalletMnemoinc,
      sendWebViewRequest,
    });
    if (!feeResponse.didWork) throw new Error(feeResponse.error);

    if (
      sparkInformation.balance <=
      sendingAmountSats + feeResponse.fee + feeResponse.supportFee
    )
      throw new Error('Insufficent balance');

    const paymentResponse = await sparkPaymenWrapper({
      address: invoice,
      paymentType: 'lightning',
      amountSats: sendingAmountSats,
      masterInfoObject,
      fee: feeResponse.fee + feeResponse.supportFee,
      memo: description,
      sparkInformation,
      userBalance: sparkInformation.balance,
      mnemonic: currentWalletMnemoinc,
      sendWebViewRequest,
    });

    if (!paymentResponse.didWork) throw new Error('Unable to send payment');

    return true;
  } catch (err) {
    console.error('Payment error in payPOSLNURL:', err);

    return false;
  }
}

/**
 * Pay to a contact using the most efficient available payment method
/**
 * @param {Object} params - Payment parameters
 * @param {Object} params.blitzContact - Information about the user you are paying
 * @param {number} params.sendingAmountSats - Amount to send in satoshis
 * @param {Object} params.masterInfoObject - Master information object
 * @param {string} params.description - Payment description
 * @param {Object} params.webViewRef - Referance to the global webview
 * @param {string} params.sparkInformation - Information about the current spark wallet context
 * @param {Object} params.currentWalletMnemoinc - Admin wallets mnemoinc
 * @returns {Promise<boolean>} - True if payment successful, false otherwise
 */
export async function payPOSContact({
  blitzContact,
  sendingAmountSats,
  masterInfoObject,
  description,
  // webViewRef,
  sparkInformation,
  currentWalletMnemoinc,
  sendWebViewRequest,
}) {
  try {
    const address = blitzContact.contacts.myProfile.sparkAddress;
    const feeResponse = await sparkPaymenWrapper({
      getFee: true,
      address: address,
      paymentType: 'spark',
      amountSats: sendingAmountSats,
      masterInfoObject,
      fee: 0,
      description: '',
      mnemonic: currentWalletMnemoinc,
      sendWebViewRequest,
    });

    if (!feeResponse.didWork) throw new Error(feeResponse.error);

    if (
      sparkInformation.balance <=
      sendingAmountSats + feeResponse.fee + feeResponse.supportFee
    )
      throw new Error('Insufficent balance');

    const paymentResponse = await sparkPaymenWrapper({
      address: address,
      paymentType: 'spark',
      amountSats: sendingAmountSats,
      masterInfoObject,
      fee: feeResponse.fee + feeResponse.supportFee,
      memo: description,
      sparkInformation,
      userBalance: sparkInformation.balance,
      mnemonic: currentWalletMnemoinc,
      sendWebViewRequest,
    });

    if (!paymentResponse.didWork) throw new Error('Unable to send payment');

    return { didWork: true, paymentResponse };
  } catch (err) {
    console.error('Payment error in payPOSContact:', err);
    return { didWork: false, error: err };
  }
}
