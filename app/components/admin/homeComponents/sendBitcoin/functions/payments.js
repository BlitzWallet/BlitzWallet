import {
  getBoltzApiUrl,
  getBoltzWsUrl,
} from '../../../../../functions/boltz/boltzEndpoitns';
import {contactsLNtoLiquidSwapInfo} from '../../contacts/internalComponents/LNtoLiquidSwap';
import handleReverseClaimWSS from '../../../../../functions/boltz/handle-reverse-claim-wss';
import {breezPaymentWrapper} from '../../../../../functions/SDK';
import {
  breezLiquidLNAddressPaymentWrapper,
  breezLiquidPaymentWrapper,
} from '../../../../../functions/breezLiquid';
import breezLNAddressPaymentWrapper from '../../../../../functions/SDK/lightningAddressPaymentWrapper';
import {
  AmountVariant,
  InputTypeVariant,
  parse,
  PayAmountVariant,
  payOnchain,
  preparePayOnchain,
} from '@breeztech/react-native-breez-sdk-liquid';
import breezLNOnchainPaymentWrapper from '../../../../../functions/SDK/breezOnchainPaymentWrapper';
import {getMempoolReccomenededFee} from '../../../../../functions/getMempoolFeeRates';
import {
  getMeltQuote,
  payLnInvoiceFromEcash,
} from '../../../../../functions/eCash/wallet';
import formatBip21LiquidAddress from '../../../../../functions/liquidWallet/formatBip21liquidAddress';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../../../../functions/crashlyticsLogs';

export async function sendLiquidPayment_sendPaymentScreen({
  sendingAmount,
  paymentInfo,
  navigate,
  fromPage,
  publishMessageFunc,
  paymentDescription,
}) {
  try {
    crashlyticsLogReport('Begining send liquid payment process');
    const formattedLiquidAddress = formatBip21LiquidAddress({
      address: paymentInfo?.data?.address,
      amount: Number(sendingAmount),
      message: paymentDescription,
    });

    const paymentResponse = await breezLiquidPaymentWrapper({
      invoice: formattedLiquidAddress,
      paymentType: 'bip21Liquid',
      shouldDrain: paymentInfo?.data?.shouldDrain,
    });

    if (!paymentResponse.didWork) {
      handleNavigation({
        navigate,
        didWork: false,
        response: {
          details: {error: paymentResponse.error, amountSat: sendingAmount},
        },
        formattingType: 'liquidNode',
      });
      return;
    }
    const {payment, fee} = paymentResponse;

    if (fromPage === 'contacts') {
      publishMessageFunc();
    }

    console.log(payment, fee);
  } catch (err) {
    console.log('sending liquid payment error', err);
    crashlyticsRecordErrorReport(err.message);
  }
}

export async function sendToLNFromLiquid_sendPaymentScreen({
  paymentInfo,
  navigate,
  sendingAmount,
  fromPage,
  publishMessageFunc,
  paymentDescription,
  shouldDrain,
}) {
  crashlyticsLogReport('Starting send to Ln from liquid payment process');
  if (paymentInfo.type === InputTypeVariant.LN_URL_PAY) {
    const paymentResponse = await breezLiquidLNAddressPaymentWrapper({
      sendAmountSat: sendingAmount,
      description: paymentDescription,
      paymentInfo: paymentInfo.data,
      shouldDrain,
    });

    if (!paymentResponse.didWork) {
      handleNavigation({
        navigate,
        didWork: false,
        response: {
          details: {error: paymentResponse.error, amountSat: sendingAmount},
        },
        formattingType: 'liquidNode',
      });
      return;
    }
    const {payment, fee} = paymentResponse;

    if (fromPage === 'contacts') {
      publishMessageFunc();
    }

    console.log(payment, fee);
    return;
  }

  const lnAddress = await getLNAddressForLiquidPayment(
    paymentInfo,
    sendingAmount,
  );

  if (!lnAddress) {
    handleNavigation({
      navigate,
      didWork: false,
      response: {
        details: {
          error: 'Unable to get valid lighting invoice',
          amountSat: sendingAmount,
        },
      },
      formattingType: 'liquidNode',
    });
    return;
  }
  const paymentResponse = await breezLiquidPaymentWrapper({
    invoice: lnAddress,
    paymentType: 'bolt11',
  });

  if (!paymentResponse.didWork) {
    handleNavigation({
      navigate,
      didWork: false,
      response: {
        details: {error: paymentResponse.error, amountSat: sendingAmount},
      },
      formattingType: 'liquidNode',
    });
    return;
  }
  const {payment, fee} = paymentResponse;

  if (fromPage === 'contacts') {
    publishMessageFunc();
  }

  console.log(payment, fee);
}

export async function sendLightningPayment_sendPaymentScreen({
  sendingAmount,
  paymentInfo,
  navigate,
  fromPage,
  publishMessageFunc,
  paymentDescription,
}) {
  crashlyticsLogReport('Starting sent lightning payment process');
  if (paymentInfo.type === InputTypeVariant.LN_URL_PAY) {
    await breezLNAddressPaymentWrapper({
      paymentInfo,
      sendingAmountSat: sendingAmount,
      paymentDescription,
      failureFunction: response =>
        handleNavigation({
          navigate,
          didWork: false,
          response: response.data,
          formattingType: 'lightningNode',
        }),
      confirmFunction: response => {
        if (fromPage === 'contacts') {
          publishMessageFunc();
        }
        setTimeout(
          () => {
            handleNavigation({
              navigate,
              didWork: true,
              response: response.data,
              formattingType: 'lightningNode',
            });
          },
          fromPage === 'contacts' ? 1000 : 0,
        );
      },
    });
    return;
  }

  await breezPaymentWrapper({
    paymentInfo: paymentInfo.data,
    amountMsat:
      paymentInfo?.data.invoice?.amountMsat || Number(sendingAmount * 1000),
    failureFunction: response =>
      handleNavigation({
        navigate,
        didWork: false,
        response,
        formattingType: 'lightningNode',
      }),
    confirmFunction: response => {
      if (fromPage === 'contacts') {
        publishMessageFunc();
      }
      setTimeout(
        () => {
          handleNavigation({
            navigate,
            didWork: true,
            response,
            formattingType: 'lightningNode',
          });
        },
        fromPage === 'contacts' ? 1000 : 0,
      );
    },
  });
}

export async function sendToLiquidFromLightning_sendPaymentScreen({
  paymentInfo,
  sendingAmount,
  navigate,
  webViewRef,
  fromPage,
  publishMessageFunc,
  paymentDescription,
}) {
  try {
    crashlyticsLogReport('Starting send to liquid from lighting process');
    const {data, publicKey, privateKey, keys, preimage, liquidAddress} =
      await contactsLNtoLiquidSwapInfo(
        paymentInfo.data.address,
        sendingAmount,
        paymentDescription,
      );

    if (!data?.invoice) throw new Error('No Invoice genereated');

    const webSocket = new WebSocket(
      `${getBoltzWsUrl(process.env.BOLTZ_ENVIRONMENT)}`,
    );
    const didHandle = await handleReverseClaimWSS({
      ref: webViewRef,
      webSocket: webSocket,
      liquidAddress: liquidAddress,
      swapInfo: data,
      preimage: preimage,
      privateKey: privateKey,
      fromPage: fromPage,
      contactsFunction: publishMessageFunc,
    });
    if (!didHandle) throw new Error('Unable to open websocket');
    crashlyticsLogReport('Sending payment');
    try {
      const prasedInput = await parse(data.invoice);
      // console.log(data);
      breezPaymentWrapper({
        paymentInfo: prasedInput,
        amountMsat: prasedInput?.invoice?.amountMsat,
        failureFunction: response =>
          handleNavigation({
            navigate,
            didWork: false,
            response,
            formattingType: 'lightningNode',
          }),
        confirmFunction: response => {
          async function pollBoltzSwapStatus() {
            let didSettleInvoice = false;
            let runCount = 0;

            while (!didSettleInvoice && runCount < 10) {
              runCount += 1;
              const resposne = await fetch(
                getBoltzApiUrl() + `/v2/swap/${data.id}`,
              );
              const boltzData = await resposne.json();

              if (boltzData.status === 'invoice.settled') {
                didSettleInvoice = true;
                handleNavigation({
                  navigate,
                  didWork: true,
                  response,
                  formattingType: 'lightningNode',
                });
              } else {
                console.log('Waiting for confirmation....');
                await new Promise(resolve => setTimeout(resolve, 5000));
              }
            }
            if (didSettleInvoice) return;
            handleNavigation({
              navigate,
              didWork: false,
              response: {
                details: {
                  error:
                    'Not able to settle swap from manual reverse swap for contacts.',
                },
              },
              formattingType: 'lightningNode',
            });
          }
          pollBoltzSwapStatus();
          console.log('CONFIRMED');
        },
      });
    } catch (err) {
      console.log(err);
      webSocket.close();
      handleNavigation({
        navigate,
        didWork: false,
        response: {
          details: {error: err, amountSat: sendingAmount},
        },
        formattingType: 'lightningNode',
      });
    }
  } catch (err) {
    console.log(err, 'SEND ERROR');
    handleNavigation({
      navigate,
      didWork: false,
      response: {
        details: {error: 'Not able to generate invoice'},
      },
      formattingType: 'lightningNode',
    });
  }
}

export async function sendPaymentUsingEcash({
  paymentInfo,
  convertedSendAmount,
  isLiquidPayment,
  navigate,
  setIsSendingPayment,
  publishMessageFunc,
  fromPage,
  paymentDescription = '',
  webViewRef,
}) {
  try {
    crashlyticsLogReport('Starting send payment using eCash');
    let invoice = null;
    let swapData = null;
    if (isLiquidPayment) {
      const {data, publicKey, privateKey, keys, preimage, liquidAddress} =
        await contactsLNtoLiquidSwapInfo(
          paymentInfo.data.address,
          convertedSendAmount,
          paymentDescription,
        );

      if (!data?.invoice) throw new Error(`Couldn't create a swap invoice.`);
      const webSocket = new WebSocket(
        `${getBoltzWsUrl(process.env.BOLTZ_ENVIRONMENT)}`,
      );
      const didHandle = await handleReverseClaimWSS({
        ref: webViewRef,
        webSocket: webSocket,
        liquidAddress: liquidAddress,
        swapInfo: data,
        preimage: preimage,
        privateKey: privateKey,
        fromPage: fromPage,
        contactsFunction: publishMessageFunc,
      });
      if (!didHandle) throw new Error('Unable to open websocket');
      swapData = data;
      invoice = data.invoice;
    } else {
      const sendingInvoice = await getLNAddressForLiquidPayment(
        paymentInfo,
        convertedSendAmount,
      );

      if (!sendingInvoice)
        throw new Error(
          'Unable to create an invoice for the lightning address.',
        );
      invoice = sendingInvoice;
    }
    if (!invoice) throw new Error('Unable to parse sending invoice.');
    console.log('Before melt quote');
    const meltQuote = await getMeltQuote(invoice);
    console.log('after melt quote');
    if (!meltQuote.quote)
      throw new Error(
        meltQuote.reason || `Not able to generate ecash quote or proofs.`,
      );

    const didPay = await payLnInvoiceFromEcash({
      quote: meltQuote.quote,
      invoice: invoice,
      proofsToUse: meltQuote.proofsToUse,
      description: paymentInfo?.data?.message || '',
    });
    if (!didPay.didWork)
      throw new Error(didPay.message || 'Unable to pay invoice from eCash');
    const response = {
      status: 'complete',
      feeSat: didPay.txObject?.fee,
      amountSat: didPay.txObject?.amount,
      details: {error: ''},
    };
    if (swapData) {
      let didSettleInvoice = false;
      let runCount = 0;

      while (!didSettleInvoice && runCount < 10) {
        runCount += 1;
        const resposne = await fetch(
          getBoltzApiUrl() + `/v2/swap/${swapData.id}`,
        );
        const boltzData = await resposne.json();

        if (boltzData.status === 'invoice.settled') {
          didSettleInvoice = true;
          handleNavigation({
            navigate,
            didWork: true,
            response,
            formattingType: 'ecash',
          });
        } else {
          console.log('Waiting for confirmation....');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      if (didSettleInvoice) return;
      throw new Error('Not able to settle manual reverse swap.');
    } else {
      if (didPay.didWork && fromPage === 'contacts') {
        publishMessageFunc();
      }
      handleNavigation({
        navigate,
        didWork: didPay.didWork,
        response,
        formattingType: 'ecash',
      });
    }
  } catch (err) {
    console.log('ecash payment error', err.message);
    const response = {
      status: 'failed',
      fee: 0,
      amountSat: 0,
      details: {
        error: err.message,
      },
    };
    handleNavigation({
      navigate,
      didWork: false,
      response,
      formattingType: 'ecash',
    });
  }
}

export async function sendBolt12Offer_sendPaymentScreen({
  sendingAmount,
  paymentInfo,
  navigate,
  fromPage,
  publishMessageFunc,
}) {
  try {
    crashlyticsLogReport('Begining send bolt12 offer payment process');

    console.log(paymentInfo?.data?.offer?.offer);
    const paymentResponse = await breezLiquidPaymentWrapper({
      invoice: paymentInfo?.data?.offer?.offer,
      paymentType: 'bolt12',
      sendAmount: sendingAmount,
    });

    if (!paymentResponse.didWork) {
      handleNavigation({
        navigate,
        didWork: false,
        response: {
          details: {error: paymentResponse.error, amountSat: sendingAmount},
        },
        formattingType: 'liquidNode',
      });
      return;
    }
    const {payment, fee} = paymentResponse;

    if (fromPage === 'contacts') {
      publishMessageFunc();
    }

    console.log(payment, fee);
  } catch (err) {
    console.log('sending bolt12 offer payment error', err);
    crashlyticsRecordErrorReport(err.message);
  }
}

export async function getLNAddressForLiquidPayment(
  paymentInfo,
  sendingValue,
  description,
) {
  let invoiceAddress;
  try {
    if (paymentInfo.type === InputTypeVariant.LN_URL_PAY) {
      const url = `${paymentInfo.data.callback}?amount=${sendingValue * 1000}${
        !!paymentInfo?.data.commentAllowed
          ? `&comment=${encodeURIComponent(
              paymentInfo?.data?.message || description || '',
            )}`
          : ''
      }`;

      console.log('Generated URL:', url);
      const response = await fetch(url);

      const bolt11Invoice = (await response.json()).pr;

      invoiceAddress = bolt11Invoice;
    } else {
      invoiceAddress = paymentInfo.data.invoice.bolt11;
    }
  } catch (err) {
    console.log('get ln address for liquid payment error', err);
    invoiceAddress = '';
  }

  return invoiceAddress;
}
export async function sendBitcoinPayment({
  paymentInfo,
  sendingValue,
  description,
  onlyPrepare,
  from,
}) {
  try {
    crashlyticsLogReport('Starting send Bitcoin payment process');
    if (from === 'liquid') {
      crashlyticsLogReport('Running liquid process');
      const satPerVbyte = (await getMempoolReccomenededFee()) || undefined;
      const prepareResponse = await preparePayOnchain({
        amount: {
          type: paymentInfo.data.shouldDrain
            ? PayAmountVariant.DRAIN
            : AmountVariant.BITCOIN,
          receiverAmountSat: paymentInfo.data.shouldDrain
            ? undefined
            : sendingValue,
        },
        feeRateSatPerVbyte: satPerVbyte,
      });

      // Check if the fees are acceptable before proceeding
      const totalFeesSat = prepareResponse.totalFeesSat;

      if (onlyPrepare) {
        return {didWork: true, fees: totalFeesSat};
      }

      const destinationAddress = paymentInfo?.data.address;

      const payOnchainRes = await payOnchain({
        address: destinationAddress,
        prepareResponse,
      });
      console.log(payOnchainRes.payment);

      return {
        didWork: true,
        amount: payOnchainRes.payment.amountSat,
        fees: payOnchainRes.payment.feesSat,
      };
    } else if (from === 'lightning') {
      crashlyticsLogReport('Running lightning process');
      const breezOnChainResponse = await breezLNOnchainPaymentWrapper({
        amountSat: sendingValue,
        onlyPrepare: onlyPrepare,
        paymentInfo: paymentInfo,
      });
      return breezOnChainResponse;
    } else {
      return {didWork: false};
    }
  } catch (err) {
    console.error(err, 'PAY ONCHAIN ERROR');
    return {didWork: false, error: JSON.stringify(err)};
  }
}

function handleNavigation({navigate, didWork, response, formattingType}) {
  navigate.reset({
    index: 0, // The top-level route index
    routes: [
      {
        name: 'HomeAdmin',
        params: {screen: 'Home'},
      },
      {
        name: 'ConfirmTxPage',
        params: {
          for: didWork ? 'paymentSucceed' : 'paymentFailed',
          information: response ? response : {},
          formattingType: formattingType,
        },
      },
    ],
  });
}
