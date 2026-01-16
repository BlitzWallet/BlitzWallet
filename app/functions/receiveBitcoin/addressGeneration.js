import {
  BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
  GENERATED_BITCOIN_ADDRESSES,
  SATSPERBITCOIN,
} from '../../constants';
import { breezLiquidReceivePaymentWrapper } from '../breezLiquid';

import customUUID from '../customUUID';
import { crashlyticsLogReport } from '../crashlyticsLogs';
import { sparkReceivePaymentWrapper } from '../spark/payments';
import { getRootstockAddress } from '../boltz/rootstock/submarineSwap';
import { formatBip21Address } from '../spark/handleBip21SparkAddress';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';
import sha256Hash from '../hash';
import { createTokensInvoice } from '../spark';
import {
  BTC_ASSET_ADDRESS,
  simulateSwap,
  USD_ASSET_ADDRESS,
} from '../spark/flashnet';
// import * as bip21 from 'bip21';

let invoiceTracker = [];

function isCurrentRequest(currentID) {
  return invoiceTracker[invoiceTracker.length - 1]?.id === currentID;
}

function updateRetryCount(requestID, retryCount) {
  const request = invoiceTracker.find(item => item.id === requestID);
  if (request) {
    request.retryCount = retryCount;
  }
}

export async function initializeAddressProcess(wolletInfo) {
  const { setAddressState, selectedRecieveOption, sendWebViewRequest } =
    wolletInfo;

  const requestUUID = wolletInfo.requestUUID || customUUID();
  const retryCount = wolletInfo.retryCount || 0;
  const startTime = wolletInfo.requestTimeStart || Date.now();

  if (!wolletInfo.requestUUID) {
    invoiceTracker.push({
      id: requestUUID,
      startTime: startTime,
      retryCount: 0,
    });
  }

  let stateTracker = {};
  let hasGlobalError = false;
  let shouldRetry = false;

  try {
    crashlyticsLogReport(
      `Running address generation function for: ${selectedRecieveOption} (attempt ${
        retryCount + 1
      })`,
    );

    setAddressState(prev => ({
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
    }));
    wolletInfo.setInitialSendAmount(0);

    // Lightning
    if (selectedRecieveOption.toLowerCase() === 'lightning') {
      const realAmount =
        wolletInfo.endReceiveType === 'BTC'
          ? wolletInfo.receivingAmount
          : Math.max(
              wolletInfo.receivingAmount,
              wolletInfo.swapLimits?.bitcoin,
            );
      wolletInfo.setInitialSendAmount(realAmount);

      const swapAmountWithFee = Math.round(
        realAmount * ((wolletInfo.poolInfoRef.lpFeeBps + 100 + 10000) / 10000),
      );

      const [response, swapResponse] = await Promise.all([
        sparkReceivePaymentWrapper({
          paymentType: 'lightning',
          amountSats: swapAmountWithFee,
          memo: wolletInfo.description,
          mnemoinc: wolletInfo.currentWalletMnemoinc,
          sendWebViewRequest,
          performSwaptoUSD: wolletInfo.endReceiveType === 'USD',
          includeSparkAddress: wolletInfo.endReceiveType !== 'USD',
        }),
        wolletInfo.endReceiveType === 'USD'
          ? simulateSwap(wolletInfo.currentWalletMnemoinc, {
              poolId: wolletInfo.poolInfoRef.lpPublicKey,
              assetInAddress: BTC_ASSET_ADDRESS,
              assetOutAddress: USD_ASSET_ADDRESS,
              amountIn: swapAmountWithFee,
            })
          : Promise.resolve(null),
      ]);

      if (!response.didWork) {
        throw new Error('errormessages.lightningInvoiceError');
      }

      stateTracker = {
        generatedAddress: response.invoice,
        fee: 0,
      };

      if (swapResponse && swapResponse?.didWork) {
        stateTracker.swapResponse = swapResponse.simulation;
        const showPriceImpact =
          parseFloat(swapResponse.simulation.priceImpact) > 5;
        if (showPriceImpact) {
          stateTracker.errorMessageText = {
            type: 'warning',
            text: 'errormessages.priceImpact',
          };
        }
      }
    }
    // Bitcoin
    else if (selectedRecieveOption.toLowerCase() === 'bitcoin') {
      let address = '';
      const walletHash = sha256Hash(wolletInfo.currentWalletMnemoinc);
      let storedBitcoinAddress = JSON.parse(
        await getLocalStorageItem(GENERATED_BITCOIN_ADDRESSES),
      );

      if (!storedBitcoinAddress) {
        storedBitcoinAddress = {};
      }

      if (storedBitcoinAddress[walletHash]) {
        address = storedBitcoinAddress[walletHash];
      } else {
        const response = await sparkReceivePaymentWrapper({
          paymentType: 'bitcoin',
          amountSats: wolletInfo.receivingAmount,
          memo: wolletInfo.description,
          mnemoinc: wolletInfo.currentWalletMnemoinc,
          sendWebViewRequest,
        });

        if (!response.didWork) {
          throw new Error('errormessages.bitcoinInvoiceError');
        }

        storedBitcoinAddress[walletHash] = response.invoice;
        address = response.invoice;
        setLocalStorageItem(
          GENERATED_BITCOIN_ADDRESSES,
          JSON.stringify(storedBitcoinAddress),
        );
      }

      stateTracker = {
        generatedAddress: wolletInfo.receivingAmount
          ? formatBip21Address({
              address: address,
              amountSat: (wolletInfo.receivingAmount / SATSPERBITCOIN).toFixed(
                8,
              ),
              message: wolletInfo.description,
              prefix: 'bitcoin',
            })
          : address,
        fee: 0,
      };
    }
    // Spark
    else if (selectedRecieveOption.toLowerCase() === 'spark') {
      let sparkAddress = '';
      if (wolletInfo.endReceiveType === 'BTC') {
        if (wolletInfo.sparkInformation.sparkAddress) {
          sparkAddress = wolletInfo.sparkInformation.sparkAddress;
        } else {
          const response = await sparkReceivePaymentWrapper({
            paymentType: 'spark',
            amountSats: wolletInfo.receivingAmount,
            memo: wolletInfo.description,
            mnemoinc: wolletInfo.currentWalletMnemoinc,
            sendWebViewRequest,
          });

          if (!response.didWork) {
            throw new Error('errormessages.sparkInvoiceError');
          }

          sparkAddress = response.invoice;
        }
      } else {
        const response = await createTokensInvoice(
          wolletInfo.currentWalletMnemoinc,
        );
        if (!response.didWork) {
          throw new Error('errormessages.sparkInvoiceError');
        }

        sparkAddress = response.invoice;
      }

      stateTracker = {
        generatedAddress: sparkAddress,
        fee: 0,
      };
    }
    // Liquid
    else if (selectedRecieveOption.toLowerCase() === 'liquid') {
      const response = await generateLiquidAddress(wolletInfo);
      if (!response) throw new Error('errormessages.liquidInvoiceError');
      stateTracker = response;
    }
    // Rootstock
    else if (selectedRecieveOption.toLowerCase() === 'rootstock') {
      const response = await generateRootstockAddress(wolletInfo);
      if (!response) throw new Error('errormessages.rootstockInvoiceError');
      stateTracker = response;
    }
  } catch (error) {
    console.log(error, 'HANDLING ERROR');

    const elapsedTime = Date.now() - startTime;

    if (
      isCurrentRequest(requestUUID) &&
      retryCount < 1 &&
      elapsedTime < 10000
    ) {
      await new Promise(res => setTimeout(res, 2000));
      console.log(`Retrying request ${requestUUID} after ${elapsedTime}ms`);

      updateRetryCount(requestUUID, retryCount + 1);

      shouldRetry = true;

      initializeAddressProcess({
        ...wolletInfo,
        retryCount: retryCount + 1,
        requestUUID: requestUUID,
        requestTimeStart: startTime,
      });

      return;
    }

    stateTracker = {
      generatedAddress: null,
      errorMessageText: {
        type: 'stop',
        text: error.message,
      },
    };
  } finally {
    if (invoiceTracker.length > 3) {
      invoiceTracker = [invoiceTracker.pop()];
    }

    if (!isCurrentRequest(requestUUID) || shouldRetry) {
      return;
    }

    if (hasGlobalError) {
      setAddressState(prev => ({
        ...prev,
        hasGlobalError: true,
        isGeneratingInvoice: false,
      }));
    } else {
      setAddressState(prev => ({
        ...prev,
        ...stateTracker,
        isGeneratingInvoice: false,
      }));
    }
  }
}

async function generateLiquidAddress(wolletInfo) {
  const { receivingAmount, setAddressState, description } = wolletInfo;

  const addressResponse = await breezLiquidReceivePaymentWrapper({
    sendAmount: receivingAmount,
    paymentType: 'liquid',
    description: description || BLITZ_DEFAULT_PAYMENT_DESCRIPTION || undefined,
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

  const { destination, receiveFeesSat } = addressResponse;

  return {
    generatedAddress: destination,
    fee: receiveFeesSat,
  };
}

async function generateRootstockAddress(wolletInfo) {
  const { signer } = wolletInfo;

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
