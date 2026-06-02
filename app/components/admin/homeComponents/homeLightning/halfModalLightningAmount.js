import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';

import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useGlobalThemeContext } from '../../../../../context-store/theme';

import { CENTER, SIZES } from '../../../../constants';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';

export default function AddAmountToLightningPath({
  handleBackPressFunction,
  setContentHeight,
  activeView,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { swapUSDPriceDollars, swapLimits } = useFlashnet();
  const { bottomPadding } = useGlobalInsets();

  const [paymentMode, setPaymentMode] = useState('BTC');
  const [amountValue, setAmountValue] = useState('');
  const [inputDenomination, setInputDenomination] = useState(null);

  const normalizedInputDenomination = inputDenomination
    ? inputDenomination
    : paymentMode === 'USD'
    ? 'fiat'
    : masterInfoObject.userBalanceDenomination !== 'fiat'
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
    paymentMode,
    inputDenomination: normalizedInputDenomination,
    fiatStats,
    usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
    masterInfoObject,
  });

  useEffect(() => {
    if (activeView === 'lightning') {
      setContentHeight(600);
    } else {
      setContentHeight(450);
    }
  }, [activeView]);

  const localSatAmount = convertDisplayToSats(amountValue);
  const canContinue =
    (paymentMode === 'USD' && localSatAmount > swapLimits.bitcoin) ||
    paymentMode === 'BTC';

  const handleDenominationToggle = () => {
    const nextDenom = getNextDenomination();
    setInputDenomination(nextDenom);
    setAmountValue(convertForToggle(amountValue, convertTextInputValue));
  };

  const navigateToReceive = useCallback(
    params => {
      const isOnReceivePage = navigate
        .getState()
        .routes.some(r => r.name === 'ReceiveBTC');
      if (isOnReceivePage) {
        navigate.popTo('ReceiveBTC', params);
      } else {
        navigate.replace('ReceiveBTC', params);
      }
    },
    [navigate],
  );

  const handleNext = useCallback(() => {
    if (!localSatAmount || Number(localSatAmount) === 0) {
      if (paymentMode === 'BTC') {
        handleBackPressFunction(() =>
          navigateToReceive({ selectedRecieveOption: 'Lightning' }),
        );
        return;
      }
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.halfModal.lightningUSDAmountRequired'),
      });
      return;
    }
    if (paymentMode === 'USD' && localSatAmount < swapLimits.bitcoin) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.receivePages.editPaymentInfo.minUSDSwap', {
          amount: displayCorrectDenomination({
            amount: swapLimits.bitcoin,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination:
                primaryDisplay.denomination === 'fiat' ? 'fiat' : 'sats',
            },
            forceCurrency: primaryDisplay.forceCurrency,
            fiatStats: conversionFiatStats,
          }),
        }),
      });
      return;
    }
    handleBackPressFunction(() =>
      navigateToReceive({
        selectedRecieveOption: 'Lightning',
        receiveAmount: Number(localSatAmount),
        endReceiveType: paymentMode,
      }),
    );
  }, [localSatAmount, paymentMode, handleBackPressFunction, navigateToReceive]);

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
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
            containerStyles={{ opacity: !amountValue ? HIDDEN_OPACITY : 1 }}
            neverHideBalance={true}
            styles={{ includeFontPadding: false, ...styles.satValue }}
            globalBalanceDenomination={secondaryDisplay.denomination}
            forceCurrency={secondaryDisplay.forceCurrency}
            forceFiatStats={secondaryDisplay.forceFiatStats}
            balance={localSatAmount}
          />
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        onPress={() =>
          navigate.push('CustomHalfModal', {
            wantedContent: 'payLinkCurrencySelect',
            currentCurrency: paymentMode,
            onSelectCurrency: cur => {
              setAmountValue('');
              setInputDenomination(null);
              setPaymentMode(cur);
            },
          })
        }
        style={[
          styles.currencyToggle,
          {
            backgroundColor:
              theme && darkModeType ? backgroundColor : backgroundOffset,
          },
        ]}
      >
        <ThemeText
          styles={styles.currencyToggleText}
          content={
            paymentMode === 'BTC'
              ? t('constants.bitcoin_upper')
              : t('constants.dollars_upper')
          }
        />
        <ThemeIcon colorOverride={textColor} size={18} iconName="ChevronDown" />
      </TouchableOpacity>

      <CustomNumberKeyboard
        showDot={primaryDisplay.denomination === 'fiat'}
        setInputValue={setAmountValue}
        usingForBalance={true}
        fiatStats={conversionFiatStats}
      />

      <CustomButton
        buttonStyles={{ ...CENTER, opacity: canContinue ? 1 : HIDDEN_OPACITY }}
        actionFunction={handleNext}
        textContent={
          !localSatAmount && paymentMode === 'BTC'
            ? t('constants.skip')
            : t('wallet.payLinks.next')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: 500,
    marginBottom: 8,
  },
  amountScrollContainer: {
    justifyContent: 'center',
    marginTop: 20,
  },
  satValue: {
    textAlign: 'center',
  },
  currencyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    ...CENTER,
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: 50,
  },
  currencyToggleText: {
    includeFontPadding: false,
  },
});
