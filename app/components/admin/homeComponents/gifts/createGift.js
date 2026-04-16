import React, { useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { CENTER, CONTENT_KEYBOARD_OFFSET, SIZES } from '../../../../constants';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useNavigation } from '@react-navigation/native';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import ChoosePaymentMethod from '../sendBitcoin/components/choosePaymentMethodContainer';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';

export default function CreateGift(props) {
  const { swapUSDPriceDollars } = useFlashnet();
  const { theme, darkModeType } = useGlobalThemeContext();
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { t } = useTranslation();
  const { bitcoinBalance, dollarBalanceToken } = useUserBalanceContext();
  const [amountValue, setAmountValue] = useState('');
  const determinePaymentMethod =
    props.route?.params?.selectedPaymentMethod || 'BTC';

  const [userInputDenomination, setUserInputDenomination] = useState(null);

  const inputDenomination = userInputDenomination
    ? userInputDenomination
    : determinePaymentMethod === 'BTC'
    ? 'sats'
    : 'fiat';

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
    paymentMode: determinePaymentMethod,
    inputDenomination,
    fiatStats,
    usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
    masterInfoObject,
  });

  const localSatAmount = convertDisplayToSats(amountValue);

  const handleDenominationToggle = () => {
    const nextDenom = getNextDenomination();
    setUserInputDenomination(nextDenom);
    setAmountValue(convertForToggle(amountValue, convertTextInputValue));
  };

  const handleSelectPaymentMethod = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'SelectPaymentMethod',
      selectedPaymentMethod: determinePaymentMethod,
      fromPage: 'CreateGift',
    });
  }, [navigate, determinePaymentMethod]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('screens.inAccount.giftPages.createGift.header')}
        containerStyles={{ marginBottom: 0 }}
      />
      <ThemeText
        styles={styles.sectionTitle}
        content={
          determinePaymentMethod === 'BTC'
            ? t('constants.bitcoin_upper')
            : t('constants.dollars_upper')
        }
      />

      <View style={styles.container}>
        <TouchableOpacity activeOpacity={1} onPress={handleDenominationToggle}>
          <FormattedBalanceInput
            maxWidth={0.9}
            amountValue={amountValue}
            inputDenomination={primaryDisplay.denomination}
            forceCurrency={primaryDisplay.forceCurrency}
            forceFiatStats={primaryDisplay.forceFiatStats}
          />

          <FormattedSatText
            containerStyles={{ opacity: !amountValue ? HIDDEN_OPACITY : 1 }}
            neverHideBalance={true}
            styles={{ includeFontPadding: false, ...styles.satValue }}
            globalBalanceDenomination={secondaryDisplay.denomination}
            forceCurrency={secondaryDisplay.forceCurrency}
            forceFiatStats={secondaryDisplay.forceFiatStats}
            balance={localSatAmount}
          />
        </TouchableOpacity>
      </View>

      <ChoosePaymentMethod
        theme={theme}
        darkModeType={darkModeType}
        determinePaymentMethod={determinePaymentMethod}
        handleSelectPaymentMethod={handleSelectPaymentMethod}
        bitcoinBalance={bitcoinBalance}
        dollarBalanceToken={dollarBalanceToken}
        masterInfoObject={masterInfoObject}
        fiatStats={fiatStats}
        t={t}
      />

      <CustomNumberKeyboard
        showDot={inputDenomination === 'fiat'}
        setInputValue={setAmountValue}
        usingForBalance={true}
        fiatStats={conversionFiatStats}
      />

      <CustomButton
        buttonStyles={[
          styles.buttonContainer,
          { opacity: localSatAmount <= 0 ? HIDDEN_OPACITY : 1 },
        ]}
        textContent={t('constants.continue')}
        actionFunction={() => {
          if (localSatAmount <= 0) return;
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'addGiftQuantity',
            amount: localSatAmount,
            amountValue,
            giftDenomination: determinePaymentMethod,
          });
        }}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
  },
  sectionTitle: {
    fontSize: SIZES.medium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    marginBottom: CONTENT_KEYBOARD_OFFSET,
  },
  buttonContainer: {
    width: 'auto',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
});
