export default function formatSparkPaymentAddress(paymentInfo, isLRC20Payment) {
  let formmateedSparkPaymentInfo = {
    address: '',
    paymentType: '',
  };

  if (paymentInfo.type === 'bolt11') {
    formmateedSparkPaymentInfo.address =
      paymentInfo?.decodedInput?.invoice?.bolt11;
    formmateedSparkPaymentInfo.paymentType = 'lightning';
  } else if (paymentInfo.type === 'spark') {
    formmateedSparkPaymentInfo.address = paymentInfo?.data?.address;
    formmateedSparkPaymentInfo.paymentType = isLRC20Payment ? 'lrc20' : 'spark';
  } else if (paymentInfo.type === 'lnUrlPay') {
    formmateedSparkPaymentInfo.address = paymentInfo?.data?.invoice;
    formmateedSparkPaymentInfo.paymentType = 'lightning';
  } else if (paymentInfo.type === 'liquid') {
    formmateedSparkPaymentInfo.address = paymentInfo?.data?.invoice;
    formmateedSparkPaymentInfo.paymentType = 'lightning';
    console.log(paymentInfo?.boltzData);
  } else if (paymentInfo?.type === 'Bitcoin') {
    formmateedSparkPaymentInfo.address = paymentInfo?.address;
    formmateedSparkPaymentInfo.paymentType = 'bitcoin';
  }
  return formmateedSparkPaymentInfo;
}
