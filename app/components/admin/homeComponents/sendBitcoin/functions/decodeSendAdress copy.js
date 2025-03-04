import {
  InputTypeVariant,
  LnUrlCallbackStatusVariant,
  lnurlAuth,
  parseInput,
  withdrawLnurl,
} from '@breeztech/react-native-breez-sdk';
import {decodeLiquidAddress} from '../../../../../functions/liquidWallet/decodeLiquidAddress';
import bip39LiquidAddressDecode from './bip39LiquidAddressDecode';
import {getLNAddressForLiquidPayment, sendBitcoinPayment} from './payments';
import {formatBalanceAmount, numberConverter} from '../../../../../functions';
import {SATSPERBITCOIN} from '../../../../../constants';
import {
  fetchOnchainLimits,
  lnurlWithdraw,
} from '@breeztech/react-native-breez-sdk-liquid';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';

export default async function decodeSendAddress({
  nodeInformation,
  btcAdress,
  goBackFunction,
  // setIsLightningPayment,
  setSendingAmount,
  setPaymentInfo,
  // setIsLoading,
  liquidNodeInformation,
  masterInfoObject,
  setWebViewArgs,
  webViewRef,
  navigate,
  setHasError,
  maxZeroConf,
  comingFromAccept,
  enteredPaymentInfo,
}) {
  try {
    let input;
    if (btcAdress.includes('cryptoqr.net')) {
      console.log(btcAdress.split('@')[1]);

      const response = await fetch(
        `https://${btcAdress.split('@')[1]}/.well-known/lnurlp/${
          btcAdress.split('@')[0]
        }`,
      );
      const data = await response.json();
      if (data.status === 'ERROR') {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Not able to get merchant payment information',
          customNavigator: () => goBackFunction(),
        });
        // Alert.alert('Not able to get merchant payment information', '', [
        //   {text: 'Ok', onPress: () => goBackFunction()},
        // ]);
        return;
      }
      const bolt11 = await getLNAddressForLiquidPayment(
        {data: data, type: InputTypeVariant.LN_URL_PAY},
        data.minSendable / 1000,
      );

      input = await parseInput(bolt11);
      if (input.invoice.amountMsat / 1000 >= maxZeroConf) {
        navigate.navigate('ErrorScreen', {
          errorMessage: `Cannot send more than ${displayCorrectDenomination({
            amount: maxZeroConf,
            nodeInformation,
            masterInfoObject,
          })} to a merchant`,
          customNavigator: () => goBackFunction(),
        });

        return;
      }
    } else {
      input = await parseInput(btcAdress);
    }

    if (input.type === InputTypeVariant.BITCOIN_ADDRESS) {
      const currentLimits = await fetchOnchainLimits();
      const amountSat = comingFromAccept
        ? enteredPaymentInfo.amount
        : input.address.amountSat || 0;

      const fromNetwork = comingFromAccept
        ? enteredPaymentInfo.from
        : liquidNodeInformation.userBalance > amountSat
        ? 'liquid'
        : nodeInformation.userBalance > amountSat
        ? 'lightning'
        : 'none';

      const shouldDrain =
        fromNetwork === 'liquid'
          ? liquidNodeInformation.userBalance - amountSat < 500
          : nodeInformation.userBalance - amountSat < 500;

      if (
        (currentLimits.send.minSat > amountSat ||
          currentLimits.send.maxSat < amountSat) &&
        amountSat
      ) {
        navigate.navigate('ErrorScreen', {
          errorMessage: `${
            amountSat < currentLimits.send.minSat ? 'Minimum' : 'Maximum'
          } send amount ${formatBalanceAmount(
            numberConverter(
              currentLimits.send[
                amountSat < currentLimits.send.minSat ? 'minSat' : 'maxSat'
              ],
              masterInfoObject.userBalanceDenomination,
              nodeInformation,
              masterInfoObject.userBalanceDenomination === 'fiat' ? 2 : 0,
            ),
          )}`,
          customNavigator: () => goBackFunction(),
        });
        return;
      }
      const fiatValue =
        Number(amountSat) /
        (SATSPERBITCOIN / (nodeInformation.fiatStats?.value || 65000));
      let paymentInfo = {
        address: input.address.address,
        amount: amountSat,
        label: input.address.label || '',
        limits: currentLimits.send,
        shouldDrain,
      };
      let paymentFee = 0;
      if (amountSat) {
        const paymentFeeResponse = await sendBitcoinPayment({
          paymentInfo: {data: paymentInfo},
          sendingValue: amountSat,
          onlyPrepare: true,
          from: fromNetwork,
        });
        if (paymentFeeResponse.didWork) {
          paymentFee = paymentFeeResponse.fees;
        } else {
          navigate.navigate('ErrorScreen', {
            errorMessage: `Sending amount is above your balance`,
            customNavigator: () => goBackFunction(),
          });
          return;
        }
      }
      paymentInfo = {
        ...paymentInfo,
        fee: paymentFee,
      };

      setPaymentInfo({
        data: paymentInfo,
        type: 'Bitcoin',
        paymentNetwork: 'Bitcoin',
        sendAmount: !amountSat
          ? ''
          : `${
              masterInfoObject.userBalanceDenomination != 'fiat'
                ? `${amountSat}`
                : fiatValue < 0.01
                ? ''
                : `${fiatValue.toFixed(2)}`
            }`,
        canEditPayment:
          comingFromAccept || input.address.amountSat ? false : true,
      });

      return;
    }
    if (input.type === InputTypeVariant.BOLT11) {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = input.invoice.timestamp + input.invoice.expiry;
      const isExpired = currentTime > expirationTime;
      if (isExpired) {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Invoice is expired',
          customNavigator: () => goBackFunction(),
        });
        return;
      }
    }

    setupLNPage({
      input,
      setSendingAmount,
      setPaymentInfo,
      goBackFunction,
      nodeInformation,
      liquidNodeInformation,
      masterInfoObject,
      setWebViewArgs,
      webViewRef,
      navigate,
      setHasError,
      comingFromAccept,
      enteredPaymentInfo,
    });
  } catch (err) {
    console.log(err, 'LIGHTNIG ERROR');
    try {
      const rawLiquidAddress = btcAdress.startsWith(
        process.env.BOLTZ_ENVIRONMENT === 'testnet'
          ? 'liquidtestnet:'
          : 'liquidnetwork:',
      )
        ? btcAdress.split('?')[0].split(':')[1]
        : btcAdress;

      const input = decodeLiquidAddress(rawLiquidAddress);

      if (input)
        setupLiquidPage({
          btcAddress: btcAdress,
          // setIsLightningPayment,
          setSendingAmount,
          setPaymentInfo,
          // setIsLoading,
          goBackFunction,
          liquidNodeInformation,
          nodeInformation,
          navigate,
          masterInfoObject,
          comingFromAccept,
          enteredPaymentInfo,
        });
      else
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Error getting liquid address',
          customNavigator: () => goBackFunction(),
        });
    } catch (err) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Not a valid Address',
        customNavigator: () => goBackFunction(),
      });
    }
  }
}
async function setupLiquidPage({
  btcAddress,
  setSendingAmount,
  setPaymentInfo,
  goBackFunction,
  liquidNodeInformation,
  nodeInformation,
  navigate,
  masterInfoObject,
  comingFromAccept,
  enteredPaymentInfo,
}) {
  let addressInfo = bip39LiquidAddressDecode(btcAddress, liquidNodeInformation);

  if (comingFromAccept) {
    console.log('RUNNING FROM ACEPT');
    addressInfo.amount = enteredPaymentInfo.amount;
    addressInfo.label = enteredPaymentInfo.description;
    addressInfo.isBip21 = true;
    const shouldDrain =
      liquidNodeInformation.userBalance - addressInfo.amount < 10
        ? true
        : false;
    addressInfo.shouldDrain = shouldDrain;
  }

  const amountSat = addressInfo.amount;
  const fiatValue =
    Number(amountSat) /
    (SATSPERBITCOIN / (nodeInformation.fiatStats?.value || 65000));

  console.log(fiatValue, 'FIAT VALUE');

  setPaymentInfo({
    data: addressInfo,
    type: 'liquid',
    paymentNetwork: 'liquid',
    sendAmount: !addressInfo.amount
      ? ''
      : `${
          masterInfoObject.userBalanceDenomination != 'fiat'
            ? `${amountSat}`
            : fiatValue < 0.01
            ? ''
            : `${fiatValue.toFixed(2)}`
        }`,
    canEditPayment: !addressInfo.isBip21,
  });

  // setSendingAmount(addressInfo.amount);
  // setPaymentInfo({type: 'liquid', addressInfo: addressInfo});

  // setTimeout(() => {
  //   setIsLoading(false);
  // }, 1000);
}

async function setupLNPage({
  input,
  setSendingAmount,
  setPaymentInfo,
  goBackFunction,
  nodeInformation,
  masterInfoObject,
  setWebViewArgs,
  webViewRef,
  navigate,
  setHasError,
  comingFromAccept,
  enteredPaymentInfo,
}) {
  try {
    if (input.type === InputTypeVariant.LN_URL_AUTH) {
      try {
        const result = await lnurlAuth(input.data);
        if (result.type === LnUrlCallbackStatusVariant.OK) {
          navigate.navigate('ErrorScreen', {
            errorMessage: 'LNURL successfully authenticated',
            customNavigator: () => goBackFunction(),
          });
        } else {
          navigate.navigate('ErrorScreen', {
            errorMessage: 'Failed to authenticate LNURL',
            customNavigator: () => goBackFunction(),
          });
        }
      } catch (err) {
        console.log(err);
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Failed to authenticate LNURL',
          customNavigator: () => goBackFunction(),
        });
      }
      return;
    } else if (input.type === InputTypeVariant.LN_URL_PAY) {
      const amountMsat = comingFromAccept
        ? enteredPaymentInfo.amount * 1000
        : input.data.minSendable;
      const fiatValue =
        Number(amountMsat / 1000) /
        (SATSPERBITCOIN / (nodeInformation.fiatStats?.value || 65000));

      console.log(fiatValue, 'FIAT VALUE');
      // setSendingAmount(
      //   `${
      //     masterInfoObject.userBalanceDenomination != 'fiat'
      //       ? amountMsat / 1000
      //       : fiatValue < 0.01
      //       ? ''
      //       : fiatValue.toFixed(2)
      //   }`,
      // );
      setPaymentInfo({
        data: comingFromAccept
          ? {...input.data, message: enteredPaymentInfo.description}
          : input.data,
        type: InputTypeVariant.LN_URL_PAY,
        paymentNetwork: 'lightning',
        sendAmount: `${
          masterInfoObject.userBalanceDenomination != 'fiat'
            ? `${Math.round(amountMsat / 1000)}`
            : fiatValue < 0.01
            ? ''
            : `${fiatValue.toFixed(2)}`
        }`,
        canEditPayment: !comingFromAccept,
      });
      return;
    } else if (input.type === InputTypeVariant.LN_URL_WITHDRAW) {
      if (
        nodeInformation.userBalance != 0 &&
        nodeInformation.inboundLiquidityMsat / 1000 >
          input.data.maxWithdrawable / 1000 + 100
      ) {
        try {
          await withdrawLnurl({
            data: input.data,
            amountMsat: input.data.maxWithdrawable,
            description: input.data.defaultDescription,
          });

          setHasError('Retrieving LNURL');
        } catch (err) {
          console.log(err);
          navigate.navigate('ErrorScreen', {
            errorMessage: 'Error comnpleting withdrawl',
            customNavigator: () => goBackFunction(),
          });
        }
      } else if (
        masterInfoObject.liquidWalletSettings.regulatedChannelOpenSize
      ) {
        const amountMsat = input.data.minWithdrawable;
        await lnurlWithdraw({
          data: input.data,
          amountMsat,
          description: 'Withdrawl',
        });
        setHasError('Retrieving LNURL');

        return;
      }
      return;
    }

    const amountMsat = comingFromAccept
      ? enteredPaymentInfo.amount * 1000
      : input.invoice.amountMsat;
    const fiatValue =
      !!amountMsat &&
      Number(amountMsat / 1000) /
        (SATSPERBITCOIN / (nodeInformation.fiatStats?.value || 65000));
    setPaymentInfo({
      data: input,
      type: InputTypeVariant.BOLT11,
      paymentNetwork: 'lightning',
      sendAmount: !amountMsat
        ? ''
        : `${
            masterInfoObject.userBalanceDenomination != 'fiat'
              ? `${Math.round(amountMsat / 1000)}`
              : fiatValue < 0.01
              ? ''
              : `${fiatValue.toFixed(2)}`
          }`,
      canEditPayment: comingFromAccept ? false : !amountMsat,
    });
    // setSendingAmount(
    //   !input.invoice.amountMsat ? '' : input.invoice.amountMsat / 1000,
    // );
    // setPaymentInfo(input);
  } catch (err) {
    navigate.navigate('ErrorScreen', {
      errorMessage: 'Not a valid Address',
      customNavigator: () => goBackFunction(),
    });

    console.log(err);
  }
}
