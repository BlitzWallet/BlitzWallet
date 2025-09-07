import {
  BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
  SATSPERBITCOIN,
} from '../../constants';
import {breezLiquidReceivePaymentWrapper} from '../breezLiquid';

import customUUID from '../customUUID';
import {crashlyticsLogReport} from '../crashlyticsLogs';
import {sparkReceivePaymentWrapper} from '../spark/payments';
import {getRootstockAddress} from '../boltz/rootstock/submarineSwap';
import {formatBip21Address} from '../spark/handleBip21SparkAddress';
// import * as bip21 from 'bip21';

let invoiceTracker = [];
export async function initializeAddressProcess(wolletInfo) {
  const {setAddressState, selectedRecieveOption} = wolletInfo;
  const requestUUID = customUUID();
  invoiceTracker.push(requestUUID);
  let stateTracker = {};
  let hasGlobalError = false;
  try {
    crashlyticsLogReport(
      `Running address geneartion functinon for: ${selectedRecieveOption} with ${JSON.stringify(
        wolletInfo,
      )}`,
    );
    setAddressState(prev => {
      return {
        ...prev,
        isGeneratingInvoice: true,
        generatedAddress: '',
        errorMessageText: {
          type: null,
          text: '',
        },
        swapPegInfo: {},
        isReceivingSwap: false,
        hasGlobalError: false,
      };
    });
    if (selectedRecieveOption.toLowerCase() === 'lightning') {
      const response = await sparkReceivePaymentWrapper({
        paymentType: 'lightning',
        amountSats: wolletInfo.receivingAmount,
        memo: wolletInfo.description,
        mnemoinc: wolletInfo.currentWalletMnemoinc,
      });
      // const response = await generateLightningAddress(wolletInfo);
      if (!response.didWork)
        throw new Error('errormessages.lightningInvioceError');
      stateTracker = {
        generatedAddress: response.invoice,
        fee: 0,
      };
      // stateTracker = response
    } else if (selectedRecieveOption.toLowerCase() === 'bitcoin') {
      const response = await sparkReceivePaymentWrapper({
        paymentType: 'bitcoin',
        amountSats: wolletInfo.receivingAmount,
        memo: wolletInfo.description,
        mnemoinc: wolletInfo.currentWalletMnemoinc,
      });
      if (!response.didWork)
        throw new Error('errormessages.bitcoinInvoiceError');
      stateTracker = {
        generatedAddress: wolletInfo.receivingAmount
          ? formatBip21Address({
              address: response.invoice,
              amountSat: (wolletInfo.receivingAmount / SATSPERBITCOIN).toFixed(
                8,
              ),
              message: wolletInfo.description,
              prefix: 'bitcoin',
            })
          : response.invoice,
        fee: 0,
      };
      // stateTracker = response;
    } else if (selectedRecieveOption.toLowerCase() === 'spark') {
      const response = await sparkReceivePaymentWrapper({
        paymentType: 'spark',
        amountSats: wolletInfo.receivingAmount,
        memo: wolletInfo.description,
        mnemoinc: wolletInfo.currentWalletMnemoinc,
      });
      // const response = await generateBitcoinAddress(wolletInfo);
      if (!response.didWork) throw new Error('errormessages.sparkInvioceError');
      stateTracker = {
        generatedAddress: response.invoice,
        fee: 0,
      };
    } else if (selectedRecieveOption.toLowerCase() === 'liquid') {
      const response = await generateLiquidAddress(wolletInfo);
      if (!response) throw new Error('errormessages.liquidInvoiceError');
      stateTracker = response;
    } else if (selectedRecieveOption.toLowerCase() === 'rootstock') {
      const response = await generateRootstockAddress(wolletInfo);
      if (!response) throw new Error('errormessages.rootstockInvoiceError');
      stateTracker = response;
    }
  } catch (error) {
    console.log(error, 'HANDLING ERROR');
    stateTracker = {
      generatedAddress: null,
      errorMessageText: {
        type: 'stop',
        text: error.message,
      },
    };
  } finally {
    if (invoiceTracker.length > 3) invoiceTracker = [invoiceTracker.pop()];
    if (invoiceTracker[invoiceTracker.length - 1] != requestUUID) return;
    if (hasGlobalError) {
      setAddressState(prev => {
        return {
          ...prev,
          hasGlobalError: true,
          isGeneratingInvoice: false,
        };
      });
    } else {
      setAddressState(prev => {
        return {
          ...prev,
          ...stateTracker,
          isGeneratingInvoice: false,
        };
      });
    }
  }
}

async function generateLiquidAddress(wolletInfo) {
  const {receivingAmount, setAddressState, description} = wolletInfo;

  const addressResponse = await breezLiquidReceivePaymentWrapper({
    sendAmount: receivingAmount,
    paymentType: 'liquid',
    description: description || BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
  });
  if (!addressResponse) {
    return {
      generatedAddress: null,
      errorMessageText: {
        type: 'stop',
        text: `errormessages.liquidInvoiceError`,
      },
    };
  }

  const {destination, receiveFeesSat} = addressResponse;

  return {
    generatedAddress: destination,
    fee: receiveFeesSat,
  };
}

async function generateRootstockAddress(wolletInfo) {
  const {signer} = wolletInfo;

  const address = await getRootstockAddress(signer);
  if (!address)
    return {
      generatedAddress: null,
      errorMessageText: {
        type: 'stop',
        text: `errormessages.rootstockInvoiceError`,
      },
    };
  return {
    generatedAddress: address,
    fee: 0,
  };
}
