import {useCallback, useMemo, useState} from 'react';
import {CENTER, ICONS} from '../../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import {FlatList, StyleSheet, View} from 'react-native';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useNavigation} from '@react-navigation/native';
import {usePOSTransactions} from '../../../../../../context-store/pos';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useGlobalInsets} from '../../../../../../context-store/insetsProvider';

export default function ViewPOSTransactions() {
  const {groupedTxs} = usePOSTransactions();
  const [employeeName, setEmployeeName] = useState('');
  const {masterInfoObject} = useGlobalContextProvider();
  const {fiatStats} = useNodeContext();
  const navigate = useNavigation();
  const {bottomPadding} = useGlobalInsets();

  const filteredList = useMemo(() => {
    return !groupedTxs
      ? []
      : groupedTxs.filter(tx => {
          const [name, info] = tx;
          return name.toLowerCase()?.startsWith(employeeName.toLowerCase());
        });
  }, [groupedTxs, employeeName]);

  const transactionItem = useCallback(({item}) => {
    const [name, {totalTipAmount}] = item;
    return (
      <View style={styles.transactionContainer}>
        <View style={styles.nameAndTipContainer}>
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
              fiatStats,
            })}`}
            CustomNumberOfLines={1}
          />
        </View>
        <CustomButton
          actionFunction={() => navigate.navigate('TotalTipsScreen', {item})}
          textContent={'View'}
        />
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
        label={'Tips to pay'}
      />
      <View style={{...styles.container, alignItems: 'center'}}>
        <CustomSearchInput
          placeholderText={'Employee name'}
          setInputText={setEmployeeName}
          containerStyles={{marginTop: 10}}
        />
        {filteredList.length ? (
          <FlatList
            style={{width: '100%'}}
            contentContainerStyle={{paddingBottom: bottomPadding + 50}}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            data={filteredList}
            renderItem={transactionItem}
            keyExtractor={([name, {total, txs}]) => name}
          />
        ) : (
          <ThemeText styles={{marginTop: 20}} content={'No tips'} />
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '95%',
    ...CENTER,
  },
  transactionContainer: {
    marginVertical: 12,
    width: '100%',
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
  nameAndTipContainer: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginRight: 'auto',
  },
});
