import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {COLORS, SIZES, SKELETON_ANIMATION_SPEED} from '../../../../constants';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import {memo, useCallback, useEffect, useRef, useState} from 'react';
import handleDBStateChange from '../../../../functions/handleDBStateChange';
import Icon from '../../../../functions/CustomElements/Icon';
import {useNavigation} from '@react-navigation/native';
import {crashlyticsLogReport} from '../../../../functions/crashlyticsLogs';
import {useSparkWallet} from '../../../../../context-store/sparkContext';
import {ThemeText} from '../../../../functions/CustomElements';
import SkeletonTextPlaceholder from '../../../../functions/CustomElements/skeletonTextView';
import GetThemeColors from '../../../../hooks/themeColors';

export const UserSatAmount = memo(function UserSatAmount({
  isConnectedToTheInternet,
  theme,
  darkModeType,
}) {
  const {sparkInformation, numberOfIncomingLNURLPayments} = useSparkWallet();
  const didMount = useRef(null);

  const {masterInfoObject, toggleMasterInfoObject, setMasterInfoObject} =
    useGlobalContextProvider();
  const {backgroundColor} = GetThemeColors();

  const saveTimeoutRef = useRef(null);
  const navigate = useNavigation();
  const [balanceWidth, setBalanceWidth] = useState(0);
  const userBalance = sparkInformation.balance;

  useEffect(() => {
    didMount.current = true;
    return () => (didMount.current = false);
  }, []);

  const handleLayout = useCallback(
    event => {
      const {width} = event.nativeEvent.layout;
      if (!didMount.current) return;
      setBalanceWidth(width);
    },
    [didMount],
  );
  //  <SkeletonPlaceholder borderRadius={4} enabled={skeletonEnabled}>
  //       <View style={styles.container}>
  //         <Image
  //           style={styles.image}
  //           resizeMode="contain"
  //           source={require('./assets/react-native-icon.png')}
  //         />
  //         <View style={styles.titleContainer}>
  //           <Text style={styles.title}>Lorem ipsum</Text>
  //           <Text style={styles.subtitle} numberOfLines={2}>
  //             Dolor sit amet, consectetur adipiscing elit, sed do eiusmod
  //             tempor.
  //           </Text>
  //         </View>
  //       </View>
  //     </SkeletonPlaceholder>

  return (
    <TouchableOpacity
      onLayout={handleLayout}
      style={styles.balanceContainer}
      onPress={() => {
        if (!isConnectedToTheInternet) {
          navigate.navigate('ErrorScreen', {
            errorMessage:
              'Please reconnect to the internet to switch your denomination',
          });
          return;
        }
        if (masterInfoObject.userBalanceDenomination === 'sats')
          handleDBStateChange(
            {userBalanceDenomination: 'fiat'},
            setMasterInfoObject,
            toggleMasterInfoObject,
            saveTimeoutRef,
          );
        else if (masterInfoObject.userBalanceDenomination === 'fiat')
          handleDBStateChange(
            {userBalanceDenomination: 'hidden'},
            setMasterInfoObject,
            toggleMasterInfoObject,
            saveTimeoutRef,
          );
        else
          handleDBStateChange(
            {userBalanceDenomination: 'sats'},
            setMasterInfoObject,
            toggleMasterInfoObject,
            saveTimeoutRef,
          );
      }}>
      <SkeletonTextPlaceholder
        highlightColor={backgroundColor}
        backgroundColor={COLORS.opaicityGray}
        speed={SKELETON_ANIMATION_SPEED}
        enabled={!sparkInformation.didConnect}>
        <View style={styles.valueContainer}>
          <FormattedSatText styles={styles.valueText} balance={userBalance} />
        </View>
        {!!numberOfIncomingLNURLPayments && (
          <TouchableOpacity
            onPress={() => {
              crashlyticsLogReport(
                'Navigating to information popup page from user sat amount',
              );
              navigate.navigate('InformationPopup', {
                CustomTextComponent: () => {
                  return (
                    <ThemeText
                      styles={styles.informationText}
                      content={`You have ${numberOfIncomingLNURLPayments} lightning address payment${
                        numberOfIncomingLNURLPayments > 1 ? 's' : ''
                      } waiting to confirm.`}
                    />
                  );
                },
                buttonText: 'I understand',
              });
            }}
            style={{...styles.pendingBalanceChange, left: balanceWidth + 5}}>
            <Icon
              color={
                darkModeType && theme ? COLORS.darkModeText : COLORS.primary
              }
              width={25}
              height={25}
              name={'pendingTxIcon'}
            />
          </TouchableOpacity>
        )}
      </SkeletonTextPlaceholder>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  balanceContainer: {
    justifyContent: 'center',
    marginBottom: 5,
    position: 'relative',
  },
  valueContainer: {
    width: '95%',
    maxWidth: 280,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  informationPopupContainer: {
    width: '100%',
    marginBottom: 30,
    flexWrap: 'wrap',
  },
  pendingBalanceChange: {position: 'absolute'},

  informationText: {marginBottom: 20, textAlign: 'center'},

  valueText: {
    fontSize: SIZES.xxLarge,
    includeFontPadding: false,
  },
});
