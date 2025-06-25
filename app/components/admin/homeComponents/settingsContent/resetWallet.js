import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {CENTER, COLORS, SIZES} from '../../../../constants';
import {useMemo, useState} from 'react';
import {terminateAccount} from '../../../../functions/secureStore';
import RNRestart from 'react-native-restart';
import {ThemeText} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import {useNavigation} from '@react-navigation/native';
import Icon from '../../../../functions/CustomElements/Icon';
import {deleteTable} from '../../../../functions/messaging/cachedMessages';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import {getAuth} from '@react-native-firebase/auth';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {deleteEcashDBTables} from '../../../../functions/eCash/db';
import {deletePOSTransactionsTable} from '../../../../functions/pos';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {removeAllLocalData} from '../../../../functions/localStorage';
import {
  deleteSparkTransactionTable,
  deleteUnpaidSparkLightningTransactionTable,
} from '../../../../functions/spark/transactions';
import {useSparkWallet} from '../../../../../context-store/sparkContext';

export default function ResetPage(props) {
  const [selectedOptions, setSelectedOptions] = useState({
    securedItems: false,
    localStoredItems: false,
  });
  const {sparkInformation} = useSparkWallet();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {liquidNodeInformation} = useNodeContext();

  const {backgroundOffset} = GetThemeColors();
  const navigate = useNavigation();

  const backgroundColor = useMemo(() => {
    return theme ? backgroundOffset : COLORS.darkModeText;
  }, [theme, backgroundOffset]);

  return (
    <View
      style={{
        flex: 1,
        width: INSET_WINDOW_WIDTH,
        ...CENTER,
        alignItems: 'center',
      }}>
      <View
        style={[
          styles.infoContainer,
          {
            marginTop: 30,
            backgroundColor: backgroundColor,
          },
        ]}>
        <ThemeText
          styles={{
            ...styles.warningHeader,
            color:
              theme && darkModeType ? COLORS.darkModeText : COLORS.cancelRed,
          }}
          content={'Are you sure?'}
        />
      </View>
      <View
        style={[
          styles.infoContainer,
          {
            backgroundColor: backgroundColor,
          },
        ]}>
        <ThemeText
          styles={{...styles.infoTitle}}
          content={'Select data to delete from this device.'}
        />
        <ThemeText
          styles={{marginBottom: 15}}
          content={
            'Any option that is selected will be removed forever. If your seed is forgotten, you WILL lose your funds.'
          }
        />

        <View
          style={[
            styles.borderView,
            {
              backgroundColor: theme
                ? COLORS.darkModeText
                : COLORS.lightModeText,
            },
          ]}></View>
        <View style={{marginTop: 15}}>
          <View style={styles.selectorContainer}>
            <TouchableOpacity
              onPress={() => handleSelectedItems('securedItems')}
              style={[
                styles.selectorDot,
                {
                  backgroundColor: selectedOptions.securedItems
                    ? theme
                      ? COLORS.darkModeText
                      : COLORS.lightModeText
                    : 'transparent',
                  borderWidth: selectedOptions.securedItems ? 0 : 2,
                  borderColor: theme
                    ? COLORS.darkModeText
                    : COLORS.lightModeText,
                },
              ]}>
              {selectedOptions.securedItems && (
                <Icon
                  width={15}
                  height={15}
                  color={theme ? COLORS.lightModeText : COLORS.darkModeText}
                  name={'expandedTxCheck'}
                />
              )}
            </TouchableOpacity>
            <ThemeText
              styles={{...styles.selectorText}}
              content={'Delete seed phrase and pin from my device'}
            />
          </View>
          <View style={{...styles.selectorContainer, marginBottom: 0}}>
            <TouchableOpacity
              onPress={() => handleSelectedItems('localStoredItems')}
              style={[
                styles.selectorDot,
                {
                  backgroundColor: selectedOptions.localStoredItems
                    ? theme
                      ? COLORS.darkModeText
                      : COLORS.lightModeText
                    : 'transparent',
                  borderWidth: selectedOptions.localStoredItems ? 0 : 2,
                  borderColor: theme
                    ? COLORS.darkModeText
                    : COLORS.lightModeText,
                },
              ]}>
              {selectedOptions.localStoredItems && (
                <Icon
                  width={15}
                  height={15}
                  color={theme ? COLORS.lightModeText : COLORS.darkModeText}
                  name={'expandedTxCheck'}
                />
              )}
            </TouchableOpacity>
            <ThemeText
              styles={{...styles.selectorText}}
              content={'Delete locally stored data from my device'}
            />
          </View>
        </View>
      </View>
      <View
        style={[
          styles.infoContainer,
          {
            backgroundColor: backgroundColor,
          },
        ]}>
        <ThemeText
          styles={{...styles.infoTitle, textAlign: 'center'}}
          content={'Your balance is'}
        />
        <FormattedSatText
          styles={{fontSize: SIZES.large}}
          neverHideBalance={true}
          balance={
            Number(sparkInformation.balance) + liquidNodeInformation.userBalance
          }
        />
      </View>

      <CustomButton
        buttonStyles={{
          opacity:
            selectedOptions.securedItems || selectedOptions.localStoredItems
              ? 1
              : 0.5,
          width: 'auto',
          marginTop: 'auto',
        }}
        actionFunction={resetWallet}
        textContent={'Reset'}
      />
    </View>
  );

  function handleSelectedItems(item) {
    setSelectedOptions(prev => {
      if (item === 'securedItems')
        return {...prev, securedItems: !prev.securedItems};
      else return {...prev, localStoredItems: !prev.localStoredItems};
    });
  }

  async function resetWallet() {
    if (!selectedOptions.localStoredItems && !selectedOptions.securedItems)
      return;

    try {
      if (selectedOptions.localStoredItems) {
        const [
          didClearLocalStoreage,
          didClearMessages,
          didClearEcash,
          didClearPos,
          didClearTxTable,
          didClearPendingTxTable,
        ] = await Promise.all([
          removeAllLocalData(),
          deleteTable(),
          deleteEcashDBTables(),
          deletePOSTransactionsTable(),
          deleteSparkTransactionTable(),
          deleteUnpaidSparkLightningTransactionTable(),
        ]);

        if (!didClearLocalStoreage)
          throw Error('Not able to delete local stored information');
      }
      if (selectedOptions.securedItems) {
        const didClearSecureItems = await terminateAccount();
        if (!didClearSecureItems)
          throw Error('Not able to delete secure stored information');
      }
      try {
        await getAuth().signOut();
      } catch (err) {
        console.log('reset wallet sign out error', err);
      }

      RNRestart.restart();
    } catch (err) {
      const errorMessage = err.message;
      console.log(errorMessage);
      navigate.navigate('ErrorScreen', {errorMessage: errorMessage});
    }
  }
}

const styles = StyleSheet.create({
  infoContainer: {
    width: '100%',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  warningHeader: {
    fontSize: SIZES.large,
    color: COLORS.cancelRed,
    fontWeight: '500',
    textAlign: 'center',
  },

  infoTitle: {
    fontWeight: '500',
    marginBottom: 10,
  },
  borderView: {
    width: '100%',
    height: 1,
  },
  selectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  selectorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  isSelectedDot: {
    backgroundColor: COLORS.primary,
  },
  selectorText: {
    width: '80%',
  },
});
