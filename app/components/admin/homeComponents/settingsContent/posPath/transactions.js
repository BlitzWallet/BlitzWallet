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
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {db} from '../../../../../../db/initializeFirebase';
import {useKeysContext} from '../../../../../../context-store/keys';
import {onSnapshot} from '@react-native-firebase/firestore';
import {decryptMessage} from '../../../../../functions/messaging/encodingAndDecodingMessages';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useNavigation} from '@react-navigation/native';

export default function ViewPOSTransactions() {
  const {publicKey, contactsPrivateKey} = useKeysContext();
  const [txList, setTxList] = useState(null);
  const [employeeName, setEmployeeName] = useState('');
  const [isAddingTotals, setIsAddingTotals] = useState(false);
  const navigate = useNavigation();
  useEffect(() => {
    const docRef = db.collection('blitzWalletUsers').doc(publicKey);
    const unsubscribe = onSnapshot(docRef, docSnap => {
      if (docSnap.exists) {
        const data = docSnap.data();

        if (data.posSettings.transactions) {
          const txs = decryptMessage(
            contactsPrivateKey,
            process.env.BACKEND_PUB_KEY,
            data.posSettings.transactions,
          );
          const parsedTxs = JSON.parse(txs);
          setTxList(parsedTxs);
        } else {
          setTxList([]);
        }
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

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
        if (!isWithinOneMonth(tx.time, oneMonthAgo)) continue;
        console.log(totals[tx.serverName]);
        if (!totals[tx.serverName]) {
          totals[tx.serverName] = 0;
        }

        totals[tx.serverName] = totals[tx.serverName] + tx.tipAmountSats;
      }
      console.log(totals);
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
            content={formatDate(item.time)}
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
    <GlobalThemeView useStandardWidth={true}>
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : null}
          style={styles.container}>
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
          ) : filteredList ? (
            <>
              <FlatList
                showsVerticalScrollIndicator={false}
                data={filteredList}
                renderItem={transactionItem}
                key={item => item.time}
              />
              <CustomButton
                useLoading={isAddingTotals}
                buttonStyles={{marginBottom: 10}}
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
            </>
          ) : (
            <View style={{flex: 1, alignItems: 'center'}}>
              <ThemeText
                styles={{marginTop: 10}}
                content={'No transactions '}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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

export const formatDate = timestamp => {
  const date = new Date(timestamp);
  const location = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  return new Intl.DateTimeFormat(location, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
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
