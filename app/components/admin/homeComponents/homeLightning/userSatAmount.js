import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {COLORS, SIZES} from '../../../../constants';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import {useGlobaleCash} from '../../../../../context-store/eCash';
import {useRef, useState} from 'react';
import handleDBStateChange from '../../../../functions/handleDBStateChange';
import Icon from '../../../../functions/CustomElements/Icon';
import {useNavigation} from '@react-navigation/native';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../context-store/appStatus';
import {useGlobalThemeContext} from '../../../../../context-store/theme';

export function UserSatAmount() {
  const {masterInfoObject, toggleMasterInfoObject, setMasterInfoObject} =
    useGlobalContextProvider();
  const {isConnectedToTheInternet} = useAppStatus();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {darkModeType, theme} = useGlobalThemeContext();
  const {ecashWalletInformation} = useGlobaleCash();
  const eCashBalance = ecashWalletInformation.balance;
  const saveTimeoutRef = useRef(null);
  const navigate = useNavigation();
  const [balanceWidth, setBalanceWidth] = useState(0);

  const userBalance =
    (masterInfoObject.liquidWalletSettings.isLightningEnabled
      ? nodeInformation.userBalance
      : 0) +
    liquidNodeInformation.userBalance +
    (masterInfoObject.enabledEcash ? eCashBalance : 0);

  return (
    <TouchableOpacity
      onLayout={event => {
        const {width} = event.nativeEvent.layout;
        setBalanceWidth(width);
      }}
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
      <View style={styles.valueContainer}>
        <FormattedSatText styles={styles.valueText} balance={userBalance} />
      </View>
      {(!!liquidNodeInformation.pendingReceive ||
        !!liquidNodeInformation.pendingSend) && (
        <TouchableOpacity
          onPress={() => {
            navigate.navigate('InformationPopup', {
              CustomTextComponent: () => {
                return (
                  <FormattedSatText
                    containerStyles={styles.informationPopupContainer}
                    frontText={'You have '}
                    balance={
                      liquidNodeInformation.pendingReceive -
                      liquidNodeInformation.pendingSend
                    }
                    backText={' waiting to confirm'}
                  />
                );
              },
              buttonText: 'I understand',
            });
          }}
          style={{...styles.pendingBalanceChange, left: balanceWidth + 5}}>
          <Icon
            color={darkModeType && theme ? COLORS.darkModeText : COLORS.primary}
            width={25}
            height={25}
            name={'pendingTxIcon'}
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

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

  valueText: {
    fontSize: SIZES.xxLarge,
    includeFontPadding: false,
  },
});
