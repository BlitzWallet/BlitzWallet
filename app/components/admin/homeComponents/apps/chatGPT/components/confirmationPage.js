import {Platform, StyleSheet, View, useWindowDimensions} from 'react-native';

import {useNavigation} from '@react-navigation/native';
import {ThemeText} from '../../../../../../functions/CustomElements';
import {COLORS, LIQUID_DEFAULT_FEE, SIZES} from '../../../../../../constants';
import FormattedSatText from '../../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../../hooks/themeColors';
import {
  LIGHTNINGAMOUNTBUFFER,
  LIQUIDAMOUTBUFFER,
} from '../../../../../../constants/math';
import {useNodeContext} from '../../../../../../../context-store/nodeContext';
import SwipeButtonNew from '../../../../../../functions/CustomElements/sliderButton';
import {useCallback} from 'react';

export default function ConfirmChatGPTPage(props) {
  const navigate = useNavigation();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const theme = props?.theme;
  const darkModeType = props?.darkModeType;
  const {textColor, backgroundOffset, backgroundColor} = GetThemeColors();

  const liquidTxFee =
    process.env.BOLTZ_ENVIRONMENT === 'testnet' ? 30 : LIQUID_DEFAULT_FEE;

  const fee =
    liquidNodeInformation.userBalance > props.price + LIQUIDAMOUTBUFFER
      ? liquidTxFee
      : nodeInformation.userBalance > props.price + LIGHTNINGAMOUNTBUFFER
      ? Math.round(props.price * 0.005 + 4)
      : 0;

  const onSwipeSuccess = useCallback(() => {
    navigate.popTo('AppStorePageIndex', {
      page: 'ai',
      purchaseCredits: true,
    });
  }, []);

  return (
    <View style={styles.container}>
      <ThemeText
        styles={{
          fontSize: SIZES.large,
          textAlign: 'center',
          marginBottom: 5,
        }}
        content={'Confirm Purchase'}
      />

      <ThemeText
        styles={{fontSize: SIZES.large, marginTop: 10}}
        content={`Plan: ${props.plan}`}
      />
      <FormattedSatText
        neverHideBalance={true}
        containerStyles={{marginTop: 'auto'}}
        styles={{
          fontSize: SIZES.large,
          textAlign: 'center',
        }}
        frontText={'Price: '}
        balance={props.price}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, alignItems: 'center'},
});
