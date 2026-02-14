import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useCallback, useState } from 'react';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import { useTranslation } from 'react-i18next';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import { useFlashnet } from '../../../../../context-store/flashnetContext';

export default function CreatePoolAmount() {
  const navigate = useNavigation();
  const { swapUSDPriceDollars } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const { t } = useTranslation();

  const [inputDenomination, setInputDenomination] = useState(
    masterInfoObject.userBalanceDenomination !== 'fiat' ? 'sats' : 'fiat',
  );

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
    paymentMode: 'BTC',
    inputDenomination,
    fiatStats,
    usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
    masterInfoObject,
  });

  const localSatAmount = convertDisplayToSats(amountValue);

  const handleDenominationToggle = () => {
    const nextDenom = getNextDenomination();
    setInputDenomination(nextDenom);
    setAmountValue(convertForToggle(amountValue, convertTextInputValue));
  };

  const handleNext = useCallback(() => {
    if (!localSatAmount || Number(localSatAmount) === 0) {
      navigate.goBack();
      return;
    }

    navigate.navigate('CustomHalfModal', {
      wantedContent: 'createPoolDescription',
      goalAmount: Number(localSatAmount),
      sliderHight: 0.5,
    });
  }, [localSatAmount, navigate]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={t('wallet.pools.createPool')}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.amountScrollContainer}
      >
        <TouchableOpacity activeOpacity={1} onPress={handleDenominationToggle}>
          <FormattedBalanceInput
            maxWidth={0.9}
            amountValue={amountValue}
            inputDenomination={primaryDisplay.denomination}
            forceCurrency={primaryDisplay.forceCurrency}
            forceFiatStats={primaryDisplay.forceFiatStats}
          />

          <FormattedSatText
            containerStyles={{
              opacity: !amountValue ? HIDDEN_OPACITY : 1,
            }}
            neverHideBalance={true}
            styles={{ includeFontPadding: false, ...styles.satValue }}
            globalBalanceDenomination={secondaryDisplay.denomination}
            forceCurrency={secondaryDisplay.forceCurrency}
            forceFiatStats={secondaryDisplay.forceFiatStats}
            balance={localSatAmount}
          />
        </TouchableOpacity>
      </ScrollView>

      <CustomNumberKeyboard
        showDot={primaryDisplay.denomination === 'fiat'}
        setInputValue={setAmountValue}
        usingForBalance={true}
        fiatStats={conversionFiatStats}
      />

      <CustomButton
        buttonStyles={{
          ...CENTER,
        }}
        actionFunction={handleNext}
        textContent={
          !localSatAmount ? t('constants.back') : t('constants.next')
        }
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  amountScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  satValue: {
    textAlign: 'center',
  },
});
