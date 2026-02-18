import { InputTypes } from 'bitcoin-address-parser';
import {
  GENERATED_BITCOIN_ADDRESSES,
  SATSPERBITCOIN,
  SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT,
} from '../../../../../constants';
import { crashlyticsLogReport } from '../../../../../functions/crashlyticsLogs';
import { sparkPaymenWrapper } from '../../../../../functions/spark/payments';
import { getLocalStorageItem } from '../../../../../functions';
import sha256Hash from '../../../../../functions/hash';

export default async function processBitcoinAddress(input, context) {
  const {
    masterInfoObject,
    comingFromAccept,
    enteredPaymentInfo,
    fiatStats,
    paymentInfo,
    currentWalletMnemoinc,
    sendWebViewRequest,
    bitcoinBalance,
    t,
  } = context;
  const storedBitcoinAddress = JSON.parse(
    await getLocalStorageItem(GENERATED_BITCOIN_ADDRESSES),
  );

  if (
    storedBitcoinAddress &&
    storedBitcoinAddress[sha256Hash(currentWalletMnemoinc)] ===
      input.data.address
  )
    throw new Error(
      t('wallet.sendPages.handlingAddressErrors.payingToSameAddress', {
        addressType: 'Bitcoin',
      }),
    );
  crashlyticsLogReport('Begining decode Bitcoin address');
  const bip21AmountSat = input.data.amount * SATSPERBITCOIN;

  const amountSat = comingFromAccept
    ? enteredPaymentInfo.amount
    : bip21AmountSat || 0;

  const fiatValue =
    Number(amountSat) / (SATSPERBITCOIN / (fiatStats?.value || 65000));

  let newPaymentInfo = {
    address: input.data.address,
    amount: amountSat,
    label: input.data.label || '',
    message: input.data.message || '',
  };

  let paymentFee = 0;
  let supportFee = 0;
  let feeQuote;
  if (
    (amountSat && amountSat >= SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT) ||
    (comingFromAccept &&
      (!paymentInfo.paymentFee ||
        !paymentInfo.supportFee ||
        !paymentInfo.feeQuote))
  ) {
    if (
      paymentInfo.paymentFee &&
      paymentInfo.supportFee &&
      paymentInfo.feeQuote
    ) {
      paymentFee = paymentInfo.paymentFee;
      supportFee = paymentInfo.supportFee;
      feeQuote = paymentInfo.feeQuote;
    } else {
      if (amountSat > bitcoinBalance) {
        throw new Error(t('wallet.sendPages.acceptButton.balanceError'));
      }

      const paymentFeeResponse = await sparkPaymenWrapper({
        getFee: true,
        address: input.data.address,
        paymentType: 'bitcoin',
        amountSats: amountSat,
        masterInfoObject,
        mnemonic: currentWalletMnemoinc,
        sendWebViewRequest,
      });

      if (!paymentFeeResponse.didWork)
        throw new Error(paymentFeeResponse.error);

      paymentFee = paymentFeeResponse.fee;
      supportFee = paymentFeeResponse.supportFee;
      feeQuote = paymentFeeResponse.feeQuote;
    }
  }

  const canEditPayment =
    comingFromAccept || amountSat >= SMALLEST_ONCHAIN_SPARK_SEND_AMOUNT
      ? false
      : true;

  const displayAmount = comingFromAccept
    ? enteredPaymentInfo.amount
    : masterInfoObject.userBalanceDenomination != 'fiat'
    ? Math.round(Number(amountSat))
    : canEditPayment
    ? fiatValue.toFixed(2)
    : Math.round(Number(amountSat));

  return {
    data: newPaymentInfo,
    type: InputTypes.BITCOIN_ADDRESS,
    paymentNetwork: 'Bitcoin',
    address: input.data.address,
    paymentFee: paymentFee,
    supportFee: supportFee,
    feeQuote,
    sendAmount: !amountSat ? '' : `${displayAmount}`,
    canEditPayment,
  };
}
