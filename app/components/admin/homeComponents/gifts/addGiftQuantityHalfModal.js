import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import {
  CENTER,
  GIFTS_QUANTITY_PRESETS,
  MAX_GIFT_QUANTITY,
  MAX_GIFTS,
  SIZES,
} from '../../../../constants';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import CustomButton from '../../../../functions/CustomElements/button';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { dollarsToSats } from '../../../../functions/spark/flashnet';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../context-store/nodeContext';

export default function AddGiftQuantityHalfModal({
  amount,
  amountValue,
  dollarAmount,
  giftDenomination,
  setContentHeight,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { fiatStats } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { bitcoinBalance, dollarBalanceToken } = useUserBalanceContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { swapLimits, poolInfoRef } = useFlashnet();

  const [step, setStep] = useState('select');
  const [customValue, setCustomValue] = useState('');

  const currentDerivedGiftIndex = masterInfoObject.currentDerivedGiftIndex || 1;

  useEffect(() => {
    setContentHeight(step === 'custom' ? 560 : 450);
  }, [step]);

  const handleBackPress = useCallback(() => {
    if (step === 'custom') {
      setStep('select');
      setCustomValue('');
      return true;
    }
    return false;
  }, [step]);

  useHandleBackPressNew(handleBackPress);

  const validateAndProceed = quantity => {
    if (!quantity || quantity <= 0) return;

    const clampedQty = Math.min(MAX_GIFT_QUANTITY, Math.max(1, quantity));

    // MAX_GIFTS check
    if (currentDerivedGiftIndex + clampedQty > MAX_GIFTS) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.inAccount.giftPages.createGift.maxGiftsError'),
      });
      return;
    }

    const totalNeeded = amount * clampedQty;
    const totalNeededUSD = dollarAmount * clampedQty;

    // Fragmentation: neither single balance is sufficent
    if (bitcoinBalance < totalNeeded && dollarBalanceToken < totalNeededUSD) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'screens.inAccount.giftPages.createGift.insufficientBalanceQuantity',
          {
            count: clampedQty,
          },
        ),
      });
      return;
    }

    const hasBTCBalance = bitcoinBalance >= totalNeeded;
    const hasUSDBalance = dollarBalanceToken >= totalNeededUSD;

    const meetsUSDMinimum = totalNeededUSD >= swapLimits.usd;
    const meetsBTCMinimum = totalNeeded >= swapLimits.bitcoin;

    console.log(hasBTCBalance, hasUSDBalance, meetsBTCMinimum, meetsUSDMinimum);

    if (giftDenomination === 'BTC') {
      const canPayBTCtoBTC = hasBTCBalance;
      const canPayUSDtoBTC = hasUSDBalance && meetsUSDMinimum;
      if (!canPayBTCtoBTC && !canPayUSDtoBTC) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('wallet.sendPages.acceptButton.swapMinimumError', {
            amount: displayCorrectDenomination({
              amount: dollarsToSats(
                swapLimits.usd,
                poolInfoRef.currentPriceAInB,
              ),
              masterInfoObject: {
                ...masterInfoObject,
                userBalanceDenomination: 'fiat',
              },
              fiatStats,
              forceCurrency: 'USD',
            }),
            currency1: t('constants.dollars_upper'),
            currency2: t('constants.bitcoin_upper'),
          }),
        });
        return;
      }
    } else {
      const canPayUSDtoUSD = hasUSDBalance;
      const canPayBTCtoUSD = hasBTCBalance && meetsBTCMinimum;
      if (!canPayUSDtoUSD && !canPayBTCtoUSD) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('wallet.sendPages.acceptButton.swapMinimumError', {
            amount: displayCorrectDenomination({
              amount: swapLimits.bitcoin,
              masterInfoObject: {
                ...masterInfoObject,
                userBalanceDenomination: 'sats',
              },
              fiatStats,
              forceCurrency: 'USD',
            }),
            currency1: t('constants.bitcoin_upper'),
            currency2: t('constants.dollars_upper'),
          }),
        });
        return;
      }
    }

    handleBackPressFunction(() => {
      navigate.goBack();
      navigate.navigate('CreateGiftDescription', {
        amount,
        amountValue,
        dollarAmount,
        giftDenomination,
        giftQuantity: clampedQty,
      });
    });
  };

  const handleCustomContinue = () => {
    if (!customValue) {
      setStep('select');
      setCustomValue('');
      return;
    }
    const qty = parseInt(customValue, 10);
    if (!qty || qty <= 0) return;
    validateAndProceed(qty);
  };

  const allItems = [
    ...GIFTS_QUANTITY_PRESETS.map(n => ({ value: n })),
    { isCustomButton: true },
  ];
  const rows = [
    allItems.slice(0, 2),
    allItems.slice(2, 4),
    allItems.slice(4, 6),
  ];

  const renderButton = item => {
    if (item.isCustomButton) {
      return (
        <TouchableOpacity
          key="custom"
          activeOpacity={0.7}
          onPress={() => setStep('custom')}
          style={[
            styles.presetButton,
            {
              backgroundColor: theme
                ? darkModeType
                  ? backgroundColor
                  : backgroundOffset
                : COLORS.darkModeText,
              borderColor: 'transparent',
            },
          ]}
        >
          <ThemeText styles={styles.presetText} content={'...'} />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={item.value}
        activeOpacity={0.7}
        onPress={() => validateAndProceed(item.value)}
        style={[
          styles.presetButton,
          {
            backgroundColor: theme
              ? darkModeType
                ? backgroundColor
                : backgroundOffset
              : COLORS.darkModeText,
            borderColor: 'transparent',
          },
        ]}
      >
        <ThemeText styles={styles.presetText} content={String(item.value)} />
      </TouchableOpacity>
    );
  };

  if (step === 'custom') {
    const customQty = parseInt(customValue, 10) || 0;
    const isValid = customQty >= 1 && customQty <= MAX_GIFT_QUANTITY;

    return (
      <View style={styles.container}>
        <View style={styles.inputContainer}>
          <ThemeText
            styles={styles.quantityDisplay}
            content={customValue || '0'}
          />
        </View>
        <ThemeText
          styles={styles.maxGiftHint}
          content={t('screens.inAccount.giftPages.createGift.maxQuantityHint')}
        />
        <CustomNumberKeyboard
          showDot={false}
          customFunction={val => {
            const num = parseInt(val, 10);
            if (!num && num !== 0) {
              console.log('t');
              if (val === 'C') {
                setCustomValue('');
              } else {
                setCustomValue(prev => prev.slice(0, -1));
              }
            } else {
              setCustomValue(prev => {
                const newVal = prev + String(num);
                const newNum = parseInt(newVal, 10);
                if (newNum > MAX_GIFT_QUANTITY) {
                  return prev;
                } else if (newNum !== 0) {
                  return newVal;
                } else return prev;
              });
            }
          }}
        />
        <CustomButton
          buttonStyles={styles.button}
          textContent={isValid ? t('constants.continue') : t('constants.back')}
          actionFunction={handleCustomContinue}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.header}
        content={t('screens.inAccount.giftPages.createGift.quantityHeader')}
      />
      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.row}>
            {row.map(item => renderButton(item))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  header: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginBottom: 20,
  },
  grid: {
    gap: 12,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  maxGiftHint: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: SIZES.small,
    marginTop: 10,
    includeFontPadding: false,
  },
  presetButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    paddingHorizontal: 8,
  },
  presetText: {
    includeFontPadding: false,
  },
  inputContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  quantityDisplay: {
    fontSize: 40,
    includeFontPadding: false,
    pointerEvents: 'none',
    paddingVertical: 0,
  },
  button: {
    width: 'auto',
    marginTop: 12,
    ...CENTER,
  },
});
