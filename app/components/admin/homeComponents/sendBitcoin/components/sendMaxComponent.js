import {useState} from 'react';
import {CENTER} from '../../../../../constants';
import {SATSPERBITCOIN} from '../../../../../constants/math';
import CustomButton from '../../../../../functions/CustomElements/button';
import {crashlyticsLogReport} from '../../../../../functions/crashlyticsLogs';
import {sparkPaymenWrapper} from '../../../../../functions/spark/payments';
import {getLNAddressForLiquidPayment} from '../functions/payments';
import {calculateBoltzFeeNew} from '../../../../../functions/boltz/boltzFeeNew';

export default function SendMaxComponent({
  fiatStats,
  sparkInformation,
  paymentInfo,
  masterInfoObject,
  setPaymentInfo,
  paymentFee,
  paymentType,
  minMaxLiquidSwapAmounts,
}) {
  console.log(masterInfoObject);
  const [isGettingMax, setIsGettingMax] = useState(false);
  return (
    <CustomButton
      buttonStyles={{
        width: 'auto',
        ...CENTER,
        marginBottom: 25,
      }}
      useLoading={isGettingMax}
      actionFunction={() => {
        sendMax();
      }}
      textContent={'Send Max'}
    />
  );
  async function sendMax() {
    try {
      crashlyticsLogReport('Starting send max process');
      setIsGettingMax(true);

      if (paymentInfo.type === 'liquid') {
        const supportFee = masterInfoObject?.enabledDeveloperSupport.isEnabled
          ? Math.ceil(
              Number(sparkInformation.balance) *
                masterInfoObject?.enabledDeveloperSupport.baseFeePercent,
            ) + Number(masterInfoObject?.enabledDeveloperSupport?.baseFee)
          : 0;
        const boltzFee = calculateBoltzFeeNew(
          Number(sparkInformation.balance),
          'ln-liquid',
          minMaxLiquidSwapAmounts.reverseSwapStats,
        );
        console.log(boltzFee, 'boltz fee');
        setPaymentInfo(prev => ({
          ...prev,
          sendAmount: String(
            Number(sparkInformation.balance) - (supportFee + boltzFee) * 1.5,
          ),
        }));
        return;
      }
      let address = paymentInfo?.address;

      if (paymentInfo.type === 'lnUrlPay') {
        const invoice = await getLNAddressForLiquidPayment(
          paymentInfo,
          Number(sparkInformation.balance),
        );
        address = invoice;
      }
      const feeResponse = await sparkPaymenWrapper({
        getFee: true,
        address: address,
        paymentType: paymentType.toLowerCase(),
        amountSats: Number(sparkInformation.balance),
        masterInfoObject,
      });

      if (!feeResponse.didWork) throw new Error(feeResponse.error);

      const maxAmountSats =
        Number(sparkInformation.balance) -
        (feeResponse.fee + feeResponse.supportFee) * 1.2;
      console.log(maxAmountSats);
      const convertedMax =
        masterInfoObject.userBalanceDenomination != 'fiat'
          ? Math.round(Number(maxAmountSats))
          : (
              Number(maxAmountSats) /
              Math.round(SATSPERBITCOIN / fiatStats?.value)
            ).toFixed(3);
      setPaymentInfo(prev => ({
        ...prev,
        sendAmount: String(convertedMax),
      }));
      return;
    } catch (err) {
      console.log(err, 'ERROR');
    } finally {
      setIsGettingMax(false);
    }
  }
}
