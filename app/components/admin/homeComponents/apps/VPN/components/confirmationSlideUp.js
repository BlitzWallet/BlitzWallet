import {StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useCallback, useEffect, useState} from 'react';
import {ThemeText} from '../../../../../../functions/CustomElements';
import {LIQUID_DEFAULT_FEE, SIZES} from '../../../../../../constants';
import FormattedSatText from '../../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../../hooks/themeColors';
import {calculateBoltzFeeNew} from '../../../../../../functions/boltz/boltzFeeNew';
import {KEYBOARDTIMEOUT} from '../../../../../../constants/styles';
import {LIGHTNINGAMOUNTBUFFER} from '../../../../../../constants/math';
import FullLoadingScreen from '../../../../../../functions/CustomElements/loadingScreen';
import {useNodeContext} from '../../../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../../../context-store/appStatus';
import SwipeButtonNew from '../../../../../../functions/CustomElements/sliderButton';

export default function ConfirmVPNPage(props) {
  const navigate = useNavigation();
  const {nodeInformation} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {
    duration,
    country,
    createVPN,
    price,
    slideHeight,
    theme,
    darkModeType,
  } = props;
  const {textColor, backgroundOffset, backgroundColor} = GetThemeColors();

  // const [liquidTxFee, setLiquidTxFee] = useState(null);
  const liquidTxFee =
    process.env.BOLTZ_ENVIRONMENT === 'testnet' ? 30 : LIQUID_DEFAULT_FEE;

  // useEffect(() => {
  //   (async () => {
  //     try {
  //       const txFee = await getLiquidTxFee({
  //         amountSat: price,
  //       });
  //       setLiquidTxFee(Number(txFee) || 250);
  //     } catch (err) {
  //       console.log(err);
  //       setLiquidTxFee(250);
  //     }
  //   })();
  // }, []);

  const fee =
    nodeInformation.userBalance > price + LIGHTNINGAMOUNTBUFFER
      ? Math.round(price * 0.005) + 4
      : liquidTxFee +
        calculateBoltzFeeNew(
          price,
          'liquid-ln',
          minMaxLiquidSwapAmounts.submarineSwapStats,
        );

  const onSwipeSuccess = useCallback(() => {
    navigate.goBack();
    setTimeout(() => {
      createVPN();
    }, KEYBOARDTIMEOUT);
  }, []);

  return (
    <View style={styles.container}>
      {!liquidTxFee ? (
        <FullLoadingScreen />
      ) : (
        <>
          <ThemeText
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
              marginBottom: 5,
            }}
            content={'Confirm Country'}
          />
          <ThemeText
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
            }}
            content={`${country}`}
          />
          <ThemeText
            styles={{fontSize: SIZES.large, marginTop: 10}}
            content={`Duration: 1 ${duration}`}
          />
          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{marginTop: 'auto'}}
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
            }}
            frontText={'Price: '}
            balance={price}
          />
          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{marginTop: 10, marginBottom: 'auto'}}
            styles={{
              textAlign: 'center',
            }}
            frontText={'Fee: '}
            balance={fee}
          />

          <SwipeButtonNew
            onSwipeSuccess={onSwipeSuccess}
            width={0.95}
            containerStyles={{marginBottom: 20}}
            thumbIconStyles={{
              backgroundColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
              borderColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
            }}
            railStyles={{
              backgroundColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
              borderColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
});
