import {useTranslation} from 'react-i18next';
import {ThemeText} from '../../../../../functions/CustomElements';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';

export default function SendTransactionFeeInfo({
  paymentFee,
  isLightningPayment,
  isLiquidPayment,
  isBitcoinPayment,
  isSparkPayment,
}) {
  const {t} = useTranslation();
  return (
    <>
      <ThemeText
        styles={{marginTop: 30}}
        content={t('wallet.sendPages.feeInfo.title')}
      />
      <FormattedSatText
        backText={t('wallet.sendPages.feeInfo.backTextToAmount', {
          amount:
            isLightningPayment || isLiquidPayment || isSparkPayment
              ? ` ${t('constants.andLower')} ${t('constants.instant')}`
              : ` ${t('constants.andLower')} ${t(
                  'wallet.sendPages.feeInfo.tenMinutes',
                  {
                    numMins: 10,
                  },
                )}`,
        })}
        neverHideBalance={true}
        styles={{includeFontPadding: false}}
        balance={paymentFee}
      />
    </>
  );
}
