import {Platform, StyleSheet, View, useWindowDimensions} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {ThemeText} from '../../../../../functions/CustomElements';
import {LIQUID_DEFAULT_FEE, SIZES} from '../../../../../constants';
import {parsePhoneNumberWithError} from 'libphonenumber-js';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../hooks/themeColors';
import {calculateBoltzFeeNew} from '../../../../../functions/boltz/boltzFeeNew';
import {KEYBOARDTIMEOUT} from '../../../../../constants/styles';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {LIGHTNINGAMOUNTBUFFER} from '../../../../../constants/math';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import SwipeButtonNew from '../../../../../functions/CustomElements/sliderButton';
import {useCallback} from 'react';

export default function ConfirmSMSPayment(props) {
  const navigate = useNavigation();
  const {nodeInformation} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const {
    areaCodeNum,
    phoneNumber,
    prices,
    page,
    sendTextMessage,
    theme,
    darkModeType,
  } = props;
  const liquidTxFee =
    process.env.BOLTZ_ENVIRONMENT === 'testnet' ? 30 : LIQUID_DEFAULT_FEE;

  const price = page === 'sendSMS' ? 1000 : prices[page];

  console.log(areaCodeNum, phoneNumber, prices, page, sendTextMessage);

  const formattedPhoneNumber = () => {
    try {
      return parsePhoneNumberWithError(
        `${areaCodeNum}${phoneNumber}`,
      ).formatInternational();
    } catch (err) {
      console.log(err);
      return 'Not a valid phone number';
    }
  };

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
      sendTextMessage();
    }, KEYBOARDTIMEOUT);
  }, []);

  return (
    <View style={styles.halfModalContainer}>
      {!liquidTxFee ? (
        <FullLoadingScreen />
      ) : (
        <>
          <ThemeText
            styles={{fontSize: SIZES.xLarge, textAlign: 'center'}}
            content={'Confirm number'}
          />
          <ThemeText
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
            }}
            content={`${formattedPhoneNumber()}`}
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
  halfModalContainer: {
    flex: 1,
    alignItems: 'center',
  },
});
