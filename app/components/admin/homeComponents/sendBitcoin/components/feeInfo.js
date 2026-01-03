import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../../functions/CustomElements';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import { useState } from 'react';
import SkeletonTextPlaceholder from '../../../../../functions/CustomElements/skeletonTextView';
import GetThemeColors from '../../../../../hooks/themeColors';
import { COLORS, SKELETON_ANIMATION_SPEED } from '../../../../../constants';
import { View } from 'react-native';

export default function SendTransactionFeeInfo({
  paymentFee,
  isLightningPayment,
  isLiquidPayment,
  isBitcoinPayment,
  isSparkPayment,
  isDecoding,
}) {
  const [layout, setlayout] = useState({ height: 45, width: 87 });
  const { backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  return (
    <>
      <ThemeText
        styles={{ marginTop: 30 }}
        content={t('wallet.sendPages.feeInfo.title')}
      />
      <SkeletonTextPlaceholder
        highlightColor={backgroundColor}
        backgroundColor={COLORS.opaicityGray}
        speed={SKELETON_ANIMATION_SPEED}
        enabled={isDecoding}
        layout={layout}
      >
        <View onLayout={event => setlayout(event.nativeEvent.layout)}>
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
            styles={{ includeFontPadding: false }}
            balance={isDecoding ? 0 : paymentFee}
          />
        </View>
      </SkeletonTextPlaceholder>
    </>
  );
}
