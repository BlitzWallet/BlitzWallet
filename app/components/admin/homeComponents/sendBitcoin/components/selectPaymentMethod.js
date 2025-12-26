import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { CENTER } from '../../../../../constants';
import {
  COLORS,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Bitcoin, DollarSign } from 'lucide-react-native';
import CheckMarkCircle from '../../../../../functions/CustomElements/checkMarkCircle';
import CustomButton from '../../../../../functions/CustomElements/button';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';

export default function SelctPaymentMethod({
  sparkBalance,
  USD_SAT_VALUE,
  convertedSendAmount,
}) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const navigate = useNavigation();
  const [selectedBalance, setSelectedBalance] = useState('');

  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();

  const handleBalanceSelection = term => {
    setSelectedBalance(term);
  };

  const selectSendingBalance = () => {
    navigate.popTo(
      'ConfirmPaymentScreen',
      {
        selectedPaymentMethod: selectedBalance,
      },
      { merge: true },
    );
    return;
  };

  return (
    <View style={styles.innerContainer}>
      <ThemeText
        styles={{ fontWeight: 500, fontSize: SIZES.large }}
        content={`Please select how you’d like to fund your ${displayCorrectDenomination(
          { amount: convertedSendAmount, masterInfoObject, fiatStats },
        )} payment.`}
      />

      <TouchableOpacity
        onPress={() => handleBalanceSelection('BTC')}
        style={styles.containerRow}
      >
        <Bitcoin
          color={theme ? COLORS.darkModeText : COLORS.lightModeText}
          size={30}
        />
        <View style={styles.textContainer}>
          <ThemeText styles={styles.balanceTitle} content={'Bitcoin'} />
          <ThemeText
            styles={styles.amountText}
            content={`${displayCorrectDenomination({
              amount: sparkBalance,
              masterInfoObject,
              fiatStats,
            })} balance`}
          />
        </View>
        <CheckMarkCircle
          isActive={selectedBalance === 'BTC'}
          containerSize={25}
          switchDarkMode={true}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => handleBalanceSelection('USD')}
        style={styles.containerRow}
      >
        <DollarSign
          color={theme ? COLORS.darkModeText : COLORS.lightModeText}
          size={30}
        />
        <View style={styles.textContainer}>
          <ThemeText styles={styles.balanceTitle} content={'USD'} />
          <ThemeText
            styles={styles.amountText}
            content={`${displayCorrectDenomination({
              amount: USD_SAT_VALUE,
              masterInfoObject,
              fiatStats,
            })} balance`}
          />
        </View>
        <CheckMarkCircle
          isActive={selectedBalance === 'USD'}
          containerSize={25}
          switchDarkMode={true}
        />
      </TouchableOpacity>
      <CustomButton
        actionFunction={selectSendingBalance}
        buttonStyles={{
          marginTop: 'auto',
          opacity: !selectedBalance ? 0.5 : 1,
        }}
        textContent={t('constants.continue')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    gap: 15,
  },

  containerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderRadius: 8,
    marginVertical: 5,
  },
  textContainer: {
    width: '100%',
    flexShrink: 1,
    marginLeft: 20,
  },
  iconSize: {
    fontSize: SIZES.xxLarge,
  },
  balanceTitle: {
    fontWeight: 500,
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  amountText: {
    opacity: 0.7,
    includeFontPadding: false,
  },

  tokenContainer: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },

  tickerText: { marginRight: 'auto', includeFontPadding: false },
  balanceText: { includeFontPadding: false },
  tokenInitialContainer: {
    width: 45,
    height: 45,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 8,
  },
  tokenImage: {
    width: 45,
    height: 45,
    flex: 1,
  },
});
