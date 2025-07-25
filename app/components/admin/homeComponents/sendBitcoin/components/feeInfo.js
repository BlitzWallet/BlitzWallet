import {ThemeText} from '../../../../../functions/CustomElements';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';

export default function SendTransactionFeeInfo({
  paymentFee,
  isLightningPayment,
  isLiquidPayment,
  isBitcoinPayment,
  isSparkPayment,
}) {
  return (
    <>
      <ThemeText styles={{marginTop: 30}} content={'Fee & Speed'} />
      <FormattedSatText
        backText={` & ${
          isLightningPayment || isLiquidPayment || isSparkPayment
            ? 'instant'
            : ' 10 minutes'
        }`}
        neverHideBalance={true}
        styles={{includeFontPadding: false}}
        balance={paymentFee}
      />
    </>
  );
}
