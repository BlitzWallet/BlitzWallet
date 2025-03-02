import {InputTypeVariant, parseInput} from '@breeztech/react-native-breez-sdk';
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
import {assetIDS} from '../../../../../functions/liquidWallet/assetIDS';
import {
  BLITZ_DEFAULT_PAYMENT_DESCRIPTION,
  SATSPERBITCOIN,
} from '../../../../../constants';
import breezLNAddressPaymentWrapper from '../../../../../functions/SDK/lightningAddressPaymentWrapper';
import {
  AmountVariant,
  PayAmountVariant,
  payOnchain,
  preparePayOnchain,
} from '@breeztech/react-native-breez-sdk-liquid';
import breezLNOnchainPaymentWrapper from '../../../../../functions/SDK/breezOnchainPaymentWrapper';
import {getMempoolReccomenededFee} from '../../../../../functions/getMempoolFeeRates';

export async function sendLiquidPayment_sendPaymentScreen({
  sendingAmount,
  paymentInfo,
  navigate,
  fromPage,
  publishMessageFunc,
  paymentDescription,
}) {
  try {
    const formattedLiquidAddress = `${
      process.env.BOLTZ_ENVIRONMENT === 'testnet'
        ? 'liquidtestnet:'
        : 'liquidnetwork:'
    }${paymentInfo?.data?.address}?assetid=${
      assetIDS['L-BTC']
    }&message=${paymentDescription}&amount=${(
      Number(sendingAmount) / SATSPERBITCOIN
    ).toFixed(8)}`;

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
    console.log(err);
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

    try {
      const prasedInput = await parseInput(data.invoice);
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

export async function getLNAddressForLiquidPayment(
  paymentInfo,
  sendingValue,
  description,
) {
  let invoiceAddress;

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
    if (from === 'liquid') {
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
