import {useCallback, useEffect, useMemo, useState} from 'react';
import {CENTER, ICONS, SIZES} from '../../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useNavigation} from '@react-navigation/native';
import {usePOSTransactions} from '../../../../../../context-store/pos';
import {formatDateToDayMonthYearTime} from '../../../../../functions/rotateAddressDateChecker';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ANDROIDSAFEAREA} from '../../../../../constants/styles';

export default function ViewPOSTransactions() {
  const {txList} = usePOSTransactions();
  const [employeeName, setEmployeeName] = useState('');
  const [isAddingTotals, setIsAddingTotals] = useState(false);
  const navigate = useNavigation();

  const insets = useSafeAreaInsets();

  const paddingBottom = Platform.select({
    ios: insets.bottom,
    android: ANDROIDSAFEAREA,
  });

  const filteredList = useMemo(() => {
    return !txList
      ? []
      : txList.filter(tx =>
          tx.serverName.toLowerCase()?.startsWith(employeeName.toLowerCase()),
        );
  }, [txList]);

  const calculateBasicTipTotals = useCallback(txArray => {
    try {
      setIsAddingTotals(true);
      let totals = {};
      const oneMonthAgo = oneMonthAgoDate();
      for (const tx of txArray) {
        if (!isWithinOneMonth(tx.timestamp, oneMonthAgo)) continue;
        const serverName = tx.serverName?.toLowerCase()?.trim();
        console.log(totals[serverName]);
        if (!totals[serverName]) {
          totals[serverName] = 0;
        }

        totals[serverName] = totals[serverName] + tx.tipAmountSats;
      }

      return {totals, fromDate: oneMonthAgo};
    } catch (err) {
      console.log('getting tip totals error', err);
    } finally {
      setIsAddingTotals(false);
    }
  }, []);

  const transactionItem = useCallback(({item}) => {
    console.log(item, 'item');
    return (
      <View style={styles.transactionContainer}>
        <View style={{flex: 1, marginRight: 10}}>
          <ThemeText
            styles={styles.nameText}
            content={item.serverName}
            CustomNumberOfLines={1}
          />
          <ThemeText
            CustomNumberOfLines={1}
            styles={{fontSize: SIZES.small}}
            content={formatDateToDayMonthYearTime(item.timestamp)}
          />
        </View>
        <View style={{alignItems: 'flex-end'}}>
          <FormattedSatText
            frontText={'Order: '}
            balance={item.orderAmountSats}
          />
          <FormattedSatText frontText={'Tip: '} balance={item.tipAmountSats} />
        </View>
      </View>
    );
  }, []);

  return (
    <GlobalThemeView styles={{paddingBottom: 0}} useStandardWidth={true}>
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        showLeftImage={false}
        leftImageBlue={ICONS.receiptIcon}
        LeftImageDarkMode={ICONS.receiptWhite}
        containerStyles={{marginBottom: 0}}
        label={'Transactions'}
      />
      <CustomSearchInput
        placeholderText={'Employee name'}
        setInputText={setEmployeeName}
        containerStyles={{marginTop: 10}}
      />
      {txList === null ? (
        <FullLoadingScreen text={'Loading transactions'} />
      ) : filteredList.length ? (
        <View style={{...styles.container, alignItems: 'center'}}>
          <FlatList
            style={{width: '100%'}}
            contentContainerStyle={{paddingBottom: paddingBottom + 50}}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            data={filteredList}
            renderItem={transactionItem}
            keyExtractor={item => item.timestamp.toString()}
          />
          <CustomButton
            useLoading={isAddingTotals}
            buttonStyles={{
              width: 'auto',
              ...CENTER,
              position: 'absolute',
              bottom: paddingBottom,
            }}
            actionFunction={() => {
              const response = calculateBasicTipTotals(txList);
              console.log(response);
              navigate.navigate('TotalTipsScreen', {
                sortedTips: response.totals,
                fromDate: response.fromDate,
              });
            }}
            textContent={'Employee Tip Totals'}
          />
        </View>
      ) : (
        <View style={{flex: 1, alignItems: 'center'}}>
          <ThemeText styles={{marginTop: 10}} content={'No transactions '} />
        </View>
      )}
    </GlobalThemeView>
  );
}

const oneMonthAgoDate = () => {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999); // Set the time to the end of the day

  const oneMonthAgo = new Date(endOfDay);
  oneMonthAgo.setMonth(endOfDay.getMonth() - 1);

  return oneMonthAgo.getTime();
};
const isWithinOneMonth = (date, oneMonthAgo) => {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999); // Set the time to the end of the day
  // Convert both dates to Unix timestamps (milliseconds)
  const dateToCompareTimestamp = new Date(date).getTime();
  const oneMonthAgoTimestamp = oneMonthAgo;

  // Check if the date is within the last month
  return (
    dateToCompareTimestamp >= oneMonthAgoTimestamp &&
    dateToCompareTimestamp <= endOfDay.getTime()
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  transactionContainer: {
    marginVertical: 10,
    width: '95%',
    ...CENTER,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    textTransform: 'capitalize',
  },
});
