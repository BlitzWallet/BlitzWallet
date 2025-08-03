import {TOKEN_TICKER_MAX_LENGTH} from '../../../../../constants';
import {ThemeText} from '../../../../../functions/CustomElements';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';

export default function SendTransactionFeeInfo({
  paymentFee,
  isLightningPayment,
  isLiquidPayment,
  isBitcoinPayment,
  isSparkPayment,
  isLRC20Payment,
  seletctedToken,
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
        balance={isLRC20Payment ? 0 : paymentFee}
        useCustomLabel={isLRC20Payment}
        customLabel={
          isLRC20Payment ? seletctedToken.tokenMetadata.tokenTicker : ''
        }
      />
    </>
  );
}
