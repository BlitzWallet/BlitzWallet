import {InputTypes} from 'bitcoin-address-parser';

export default function formatSparkPaymentAddress(paymentInfo, isLRC20Payment) {
  let formmateedSparkPaymentInfo = {
    address: '',
    paymentType: '',
  };

  if (paymentInfo.type === InputTypes.BOLT11) {
    formmateedSparkPaymentInfo.address =
      paymentInfo?.decodedInput?.data?.address;
    formmateedSparkPaymentInfo.paymentType = 'lightning';
  } else if (paymentInfo.type === 'spark') {
    formmateedSparkPaymentInfo.address = paymentInfo?.data?.address;
    formmateedSparkPaymentInfo.paymentType = isLRC20Payment ? 'lrc20' : 'spark';
  } else if (paymentInfo.type === InputTypes.LNURL_PAY) {
    formmateedSparkPaymentInfo.address = paymentInfo?.data?.invoice;
    formmateedSparkPaymentInfo.paymentType = 'lightning';
  } else if (paymentInfo.type === 'liquid') {
    formmateedSparkPaymentInfo.address = paymentInfo?.data?.invoice;
    formmateedSparkPaymentInfo.paymentType = 'lightning';
  } else if (paymentInfo?.type === InputTypes.BITCOIN_ADDRESS) {
    formmateedSparkPaymentInfo.address = paymentInfo?.address;
    formmateedSparkPaymentInfo.paymentType = 'bitcoin';
  }
  return formmateedSparkPaymentInfo;
}
