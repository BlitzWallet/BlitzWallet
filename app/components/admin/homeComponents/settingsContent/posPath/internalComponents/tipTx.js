import {useState} from 'react';
import {CENTER, SIZES} from '../../../../../../constants';
import {StyleSheet, View} from 'react-native';
import displayCorrectDenomination from '../../../../../../functions/displayCorrectDenomination';
import {formatDateToDayMonthYear} from '../../../../../../functions/rotateAddressDateChecker';
import {updateDidPayForSingleTx} from '../../../../../../functions/pos';
import {ThemeText} from '../../../../../../functions/CustomElements';
import CustomButton from '../../../../../../functions/CustomElements/button';

export default function TipsTXItem({item, masterInfoObject, fiatStats, t}) {
  const [isLoading, setIsLoading] = useState(false);
  return (
    <View style={styles.txContainer}>
      <View style={{flex: 1, marginRight: 5}}>
        <ThemeText
          CustomNumberOfLines={1}
          content={t('settings.posPath.internalComponents.tipTx.tipMessage', {
            amount: displayCorrectDenomination({
              amount: item?.tipAmountSats,
              masterInfoObject,
              fiatStats,
            }),
          })}
        />
        <ThemeText
          CustomNumberOfLines={1}
          styles={{fontSize: SIZES.small}}
          content={`${formatDateToDayMonthYear(item?.dbDateAdded)}`}
        />
      </View>
      <CustomButton
        useLoading={isLoading}
        actionFunction={async () => {
          setIsLoading(true);
          await updateDidPayForSingleTx(
            item?.didPay ? 0 : 1,
            item?.dbDateAdded,
          );
          setIsLoading(false);
        }}
        buttonStyles={{maxWidth: '45%'}}
        textStyles={{textAlign: 'center'}}
        textContent={t('settings.posPath.internalComponents.tipTx.ctaBTN', {
          option: item?.didPay
            ? t('constants.unpaidLower')
            : t('constants.paidLower'),
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  txContainer: {
    width: '95%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
    ...CENTER,
  },
});
