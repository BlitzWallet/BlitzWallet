import {useCallback, useMemo, useState} from 'react';
import {CENTER, ICONS, SIZES} from '../../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import {
  FlatList,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useNavigation} from '@react-navigation/native';
import {usePOSTransactions} from '../../../../../../context-store/pos';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ANDROIDSAFEAREA} from '../../../../../constants/styles';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {deleteEmployee} from '../../../../../functions/pos';

export default function ViewPOSTransactions() {
  const {groupedTxs} = usePOSTransactions();
  const [employeeName, setEmployeeName] = useState('');
  const {masterInfoObject} = useGlobalContextProvider();
  const {nodeInformation} = useNodeContext();
  const navigate = useNavigation();

  const insets = useSafeAreaInsets();

  const paddingBottom = Platform.select({
    ios: insets.bottom,
    android: ANDROIDSAFEAREA,
  });

  const filteredList = useMemo(() => {
    return !groupedTxs
      ? []
      : groupedTxs.filter(tx => {
          const [name, info] = tx;
          return name.toLowerCase()?.startsWith(employeeName.toLowerCase());
        });
  }, [groupedTxs]);

  const removeEmployee = useCallback(async name => {
    navigate.navigate('ConfirmActionPage', {
      confirmMessage: 'Are you sure you want to remove this employee?',
      confirmFunction: () => deleteEmployee(name),
    });
  }, []);

  const transactionItem = useCallback(({item}) => {
    const [name, {totalTipAmount}] = item;

    return (
      <TouchableOpacity
        onLongPress={() => removeEmployee(name)}
        activeOpacity={1}>
        <View style={styles.transactionContainer}>
          <View
            style={{
              flex: 1,
              flexDirection: 'column',
              alignItems: 'flex-start',
              marginRight: 'auto',
            }}>
            <View style={styles.nameContainer}>
              <ThemeText
                styles={styles.nameText}
                content={name}
                CustomNumberOfLines={1}
              />
            </View>
            <ThemeText
              content={`Unpaid tips: ${displayCorrectDenomination({
                amount: totalTipAmount,
                masterInfoObject,
                nodeInformation,
              })}`}
              CustomNumberOfLines={1}
            />
          </View>
          <CustomButton
            actionFunction={() => navigate.navigate('TotalTipsScreen', {item})}
            textContent={'View'}
          />
        </View>
      </TouchableOpacity>
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
        label={'Tips to pay'}
      />
      <CustomSearchInput
        placeholderText={'Employee name'}
        setInputText={setEmployeeName}
        containerStyles={{marginTop: 10}}
      />
      {filteredList.length ? (
        <View style={{...styles.container, alignItems: 'center'}}>
          <FlatList
            style={{width: '100%'}}
            contentContainerStyle={{paddingBottom: paddingBottom + 50}}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            data={filteredList}
            renderItem={transactionItem}
            keyExtractor={([name, {total, txs}]) => name}
          />
          <CustomButton
            buttonStyles={{
              width: 'auto',
              ...CENTER,
              position: 'absolute',
              bottom: paddingBottom,
            }}
            actionFunction={() => {
              navigate.navigate('TotalTipsScreen');
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  transactionContainer: {
    marginVertical: 12,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    textTransform: 'capitalize',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 5,
  },
  image: {
    height: 12,
    width: 12,
  },
});
