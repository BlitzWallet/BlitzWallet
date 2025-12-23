import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  COLORS,
  FONT,
  SATSPERBITCOIN,
  SIZES,
  SKELETON_ANIMATION_SPEED,
  USDB_TOKEN_ID,
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
import formatTokensNumber from '../../../../functions/lrc20/formatTokensBalance';
import { useNodeContext } from '../../../../../context-store/nodeContext';

export const UserSatAmount = memo(function UserSatAmount({
  isConnectedToTheInternet,
  theme,
  darkModeType,
  sparkInformation,
  mode,
}) {
  // const didMount = useRef(null);
  const { fiatStats } = useNodeContext();
  const { masterInfoObject, toggleMasterInfoObject, setMasterInfoObject } =
    useGlobalContextProvider();
  const { backgroundColor } = GetThemeColors();

  const saveTimeoutRef = useRef(null);
  const navigate = useNavigation();
  // const [balanceWidth, setBalanceWidth] = useState(0);
  const tokenInformation = sparkInformation?.tokens?.[USDB_TOKEN_ID];
  const usdBalance =
    formatTokensNumber(
      tokenInformation?.balance,
      tokenInformation?.tokenMetadata?.decimals,
    ) ?? 0;
  const satsPerDollar = SATSPERBITCOIN / (fiatStats?.value || 100000);
  const satUSDValue = satsPerDollar * usdBalance;
  const userBalance = sparkInformation.balance;
  const initialValueRef = useRef(masterInfoObject.userBalanceDenomination);
  const { t } = useTranslation();
  const [layout, setlayout] = useState({ height: 45, width: 87 });
  console.log(tokenInformation, usdBalance, satUSDValue);
  const displayBalance =
    mode === 'total'
      ? userBalance + (isNaN(satUSDValue) ? 0 : satUSDValue)
      : mode === 'sats'
      ? userBalance
      : isNaN(satUSDValue)
      ? 0
      : satUSDValue;

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

  const handleBalanceChange = useCallback(() => {
    if (mode !== 'total') return;
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    if (!sparkInformation.didConnect) return;

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
    sparkInformation.didConnect,
  ]);

  return (
    <TouchableOpacity
      // onLayout={handleLayout}
      style={styles.balanceContainer}
      onPress={handleBalanceChange}
      activeOpacity={mode === 'total' ? 0.2 : 1}
    >
      <SkeletonTextPlaceholder
        highlightColor={backgroundColor}
        backgroundColor={COLORS.opaicityGray}
        speed={SKELETON_ANIMATION_SPEED}
        enabled={!sparkInformation.didConnect}
        layout={layout}
      >
        <View onLayout={event => setlayout(event.nativeEvent.layout)}>
          <FormattedSatText
            useSpaces={sparkInformation.didConnect || userBalance}
            styles={styles.valueText}
            balance={displayBalance}
            useSizing={true}
            globalBalanceDenomination={
              mode === 'total' ? undefined : mode === 'sats' ? 'sats' : 'fiat'
            }
            forceCurrency={mode === 'usd' ? 'USD' : null}
          />
        </View>
      </SkeletonTextPlaceholder>
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
