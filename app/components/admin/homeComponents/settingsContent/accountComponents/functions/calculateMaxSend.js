export default async function calculateMaxAccountTransfer(
  sendAmountSat,
  masterInfoObject,
  sendAddress,
) {
  try {
    // const response = await sparkPaymenWrapper({
    //   getFee: true,
    //   address: sendAddress,
    //   paymentType: 'spark',
    //   amountSats: Number(sendAmountSat),
    //   masterInfoObject,
    // });

    // if (!response.didWork) throw new Error(response.error);

    // return response.fee + response.supportFeeResponse;
    return 0;
  } catch (err) {
    console.log('Calculate max send error', err);
    return 0;
  }
}
