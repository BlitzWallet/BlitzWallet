import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  COLORS,
  FONT,
  SIZES,
  SKELETON_ANIMATION_SPEED,
} from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import handleDBStateChange from '../../../../functions/handleDBStateChange';
import { useNavigation } from '@react-navigation/native';
import SkeletonTextPlaceholder from '../../../../functions/CustomElements/skeletonTextView';
import GetThemeColors from '../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';

export const UserSatAmount = memo(function UserSatAmount({
  isConnectedToTheInternet,
  theme,
  darkModeType,
  sparkInformation,
}) {
  // const didMount = useRef(null);

  const { masterInfoObject, toggleMasterInfoObject, setMasterInfoObject } =
    useGlobalContextProvider();
  const { backgroundColor } = GetThemeColors();

  const saveTimeoutRef = useRef(null);
  const navigate = useNavigation();
  // const [balanceWidth, setBalanceWidth] = useState(0);
  const userBalance = sparkInformation.balance;
  const initialValueRef = useRef(masterInfoObject.userBalanceDenomination);
  const { t } = useTranslation();
  const [layout, setlayout] = useState({ height: 45, width: 87 });

  // useEffect(() => {
  //   didMount.current = true;
  //   return () => (didMount.current = false);
  // }, []);

  // const handleLayout = useCallback(
  //   event => {
  //     const { width } = event.nativeEvent.layout;
  //     if (!didMount.current) return;
  //     setBalanceWidth(width);
  //   },
  //   [didMount],
  // );

  return (
    <TouchableOpacity
      // onLayout={handleLayout}
      style={styles.balanceContainer}
      onPress={() => {
        if (!isConnectedToTheInternet) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('errormessages.nointernet'),
          });
          return;
        }
        if (masterInfoObject.userBalanceDenomination === 'sats')
          handleDBStateChange(
            { userBalanceDenomination: 'fiat' },
            setMasterInfoObject,
            toggleMasterInfoObject,
            saveTimeoutRef,
            initialValueRef,
          );
        else if (masterInfoObject.userBalanceDenomination === 'fiat')
          handleDBStateChange(
            { userBalanceDenomination: 'hidden' },
            setMasterInfoObject,
            toggleMasterInfoObject,
            saveTimeoutRef,
            initialValueRef,
          );
        else
          handleDBStateChange(
            { userBalanceDenomination: 'sats' },
            setMasterInfoObject,
            toggleMasterInfoObject,
            saveTimeoutRef,
            initialValueRef,
          );
      }}
    >
      <SkeletonTextPlaceholder
        highlightColor={backgroundColor}
        backgroundColor={COLORS.opaicityGray}
        speed={SKELETON_ANIMATION_SPEED}
        enabled={!sparkInformation.didConnect}
        layout={layout}
      >
        <View
          onLayout={event => setlayout(event.nativeEvent.layout)}
          style={styles.valueContainer}
        >
          <FormattedSatText
            useSpaces={sparkInformation.didConnect || userBalance}
            styles={styles.valueText}
            balance={userBalance || 0}
          />
        </View>
      </SkeletonTextPlaceholder>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  balanceContainer: {
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  valueContainer: {
    flexDirection: 'row',
  },

  informationPopupContainer: {
    width: '100%',
    marginBottom: 30,
    flexWrap: 'wrap',
  },
  pendingBalanceChange: { position: 'absolute' },

  informationText: { marginBottom: 20, textAlign: 'center' },

  valueText: {
    fontSize: SIZES.xxLarge,
    textAlign: 'center',
    fontFamily: FONT.Title_Regular,
  },
});
