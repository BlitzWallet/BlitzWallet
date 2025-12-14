import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CENTER, COLORS, SIZES } from '../../../../../../constants';
import displayCorrectDenomination from '../../../../../../functions/displayCorrectDenomination';
import { formatDateToDayMonthYear } from '../../../../../../functions/rotateAddressDateChecker';
import { updateDidPayForSingleTx } from '../../../../../../functions/pos';
import { ThemeText } from '../../../../../../functions/CustomElements';
import CustomButton from '../../../../../../functions/CustomElements/button';
import CustomToggleSwitch from '../../../../../../functions/CustomElements/switch';
import GetThemeColors from '../../../../../../hooks/themeColors';

export default function TipsTXItem({
  item,
  masterInfoObject,
  fiatStats,
  t,
  theme,
  darkModeType,
  backgroundColor,
  backgroundOffset,
  borderColor,
  isLastIndex,
}) {
  const { textColor } = GetThemeColors();
  const [isLoading, setIsLoading] = useState(false);

  const handleTogglePayment = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const newPaymentStatus = item?.didPay ? 0 : 1;
      await updateDidPayForSingleTx(newPaymentStatus, item?.dbDateAdded);
    } catch (error) {
      console.error('Error updating payment status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.txContainer,
        {
          borderBottomColor: borderColor,
          borderBottomWidth: isLastIndex ? 0 : 3,
          paddingBottom: isLastIndex ? 0 : 10,
        },
      ]}
    >
      <View style={styles.leftContainer}>
        <View style={styles.amountRow}>
          <ThemeText
            styles={styles.amountText}
            CustomNumberOfLines={1}
            content={displayCorrectDenomination({
              amount: item?.tipAmountSats,
              masterInfoObject,
              fiatStats,
            })}
          />
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: !item?.didPay
                  ? backgroundColor
                  : theme && darkModeType
                  ? COLORS.darkModeText
                  : COLORS.primary,
              },
            ]}
          >
            <ThemeText
              styles={{
                color: !item?.didPay
                  ? textColor
                  : theme && darkModeType
                  ? COLORS.lightModeText
                  : COLORS.darkModeText,
                includeFontPadding: false,
                fontSize: SIZES.smedium,
                textTransform: 'capitalize',
              }}
              content={
                !item?.didPay
                  ? t('constants.unpaidLower')
                  : t('constants.paidLower')
              }
            />
          </View>
        </View>
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.dateText}
          content={`${formatDateToDayMonthYear(item?.dbDateAdded)}`}
        />
      </View>
      <View style={styles.rightContainer}>
        <CustomToggleSwitch
          page="tipPaymentStatus"
          stateValue={item?.didPay}
          toggleSwitchFunction={handleTogglePayment}
          containerStyles={[
            styles.toggleContainer,
            { opacity: isLoading ? 0.5 : 1 },
          ]}
        />
        <ThemeText
          styles={styles.statusText}
          content={
            !item?.didPay
              ? t('constants.unpaidLower')
              : t('constants.paidLower')
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  txContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 3,
    ...CENTER,
  },
  leftContainer: {
    flex: 1,
    marginRight: 5,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  amountText: {
    includeFontPadding: false,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 10,
    marginLeft: 10,
    borderRadius: 8,
  },
  dateText: {
    fontSize: SIZES.small,
  },
  rightContainer: {
    alignItems: 'center',
  },
  toggleContainer: {
    pointerEvents: 'auto',
  },
  statusText: {
    includeFontPadding: false,
    fontSize: SIZES.smedium,
    textTransform: 'capitalize',
    marginTop: 3,
  },
});
