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
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import { formatBalanceAmount } from '../../../../functions';

export const UserSatAmount = memo(function UserSatAmount({
  isConnectedToTheInternet,
  theme,
  darkModeType,
  sparkInformation,
  mode,
}) {
  // const didMount = useRef(null);
  const { bitcoinBalance, dollarBalanceToken, totalSatValue } =
    useUserBalanceContext();

  const { masterInfoObject, toggleMasterInfoObject, setMasterInfoObject } =
    useGlobalContextProvider();
  const { backgroundColor } = GetThemeColors();

  const saveTimeoutRef = useRef(null);
  const navigate = useNavigation();
  // const [balanceWidth, setBalanceWidth] = useState(0);

  const initialValueRef = useRef(masterInfoObject.userBalanceDenomination);
  const { t } = useTranslation();
  const [layout, setlayout] = useState({ height: 45, width: 87 });
  const maxLayoutRef = useRef({ height: 45, width: 87 });

  const displayBalance =
    mode === 'total'
      ? totalSatValue
      : mode === 'sats'
      ? bitcoinBalance
      : formatBalanceAmount(dollarBalanceToken, false, masterInfoObject);

  const handleLayoutMeasurement = useCallback(event => {
    const { height, width } = event.nativeEvent.layout;

    const newMaxHeight = Math.max(maxLayoutRef.current.height, height);
    const newMaxWidth = Math.max(maxLayoutRef.current.width, width);

    if (
      newMaxHeight !== maxLayoutRef.current.height ||
      newMaxWidth !== maxLayoutRef.current.width
    ) {
      maxLayoutRef.current = { height: newMaxHeight, width: newMaxWidth };
      setlayout({ height: newMaxHeight, width: newMaxWidth });
    }
  }, []);

  const handleBalanceChange = useCallback(() => {
    if (mode !== 'total') return;
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    if (!sparkInformation.identityPubKey) return;

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
  }, [
    isConnectedToTheInternet,
    masterInfoObject.userBalanceDenomination,
    sparkInformation.identityPubKey,
  ]);

  return (
    <TouchableOpacity
      // onLayout={handleLayout}
      style={styles.balanceContainer}
      onPress={handleBalanceChange}
      activeOpacity={mode === 'total' ? 0.2 : 1}
    >
      {/* Hidden component for layout measurement */}
      <View
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        onLayout={handleLayoutMeasurement}
      >
        <FormattedSatText
          styles={styles.valueText}
          balance={displayBalance}
          useSizing={true}
          globalBalanceDenomination={
            masterInfoObject.userBalanceDenomination === 'hidden'
              ? masterInfoObject.userBalanceDenomination
              : mode === 'total'
              ? undefined
              : mode === 'sats'
              ? 'sats'
              : 'fiat'
          }
          forceCurrency={mode === 'usd' ? 'USD' : null}
          useBalance={mode === 'usd'}
        />
      </View>

      {/* Visible component with skeleton - using max layout dimensions */}
      <View
        style={{
          height: layout.height,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <SkeletonTextPlaceholder
          highlightColor={backgroundColor}
          backgroundColor={COLORS.opaicityGray}
          speed={SKELETON_ANIMATION_SPEED}
          enabled={!sparkInformation.identityPubKey}
          layout={layout}
        >
          <FormattedSatText
            styles={styles.valueText}
            balance={displayBalance}
            useSizing={true}
            globalBalanceDenomination={
              masterInfoObject.userBalanceDenomination === 'hidden'
                ? masterInfoObject.userBalanceDenomination
                : mode === 'total'
                ? undefined
                : mode === 'sats'
                ? 'sats'
                : 'fiat'
            }
            forceCurrency={mode === 'usd' ? 'USD' : null}
            useBalance={mode === 'usd'}
          />
        </SkeletonTextPlaceholder>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  balanceContainer: {
    justifyContent: 'center',
    // marginBottom: 20,
    position: 'relative',
    width: INSET_WINDOW_WIDTH,
    minHeight: 45,
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
