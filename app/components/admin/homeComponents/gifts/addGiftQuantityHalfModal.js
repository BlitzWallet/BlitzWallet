import { useCallback, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import {
  CENTER,
  FONT,
  GIFTS_QUANTITY_PRESETS,
  MAX_GIFT_QUANTITY,
  MAX_GIFTS,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import { useTheme } from '../../../../../context-store/theme';
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
import AnimatedStep, {
  growThenStep,
  useStepSheetHeight,
} from '../../../../functions/CustomElements/redesign/AnimatedStep';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import { formatGiftAmount } from './giftDisplay';

const SELECT_HEIGHT = 450;
const CUSTOM_HEIGHT = 560;

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
  const { tokens } = useTheme();
  const { bitcoinBalance, dollarBalanceToken } = useUserBalanceContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { swapLimits, poolInfoRef } = useFlashnet();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const [step, setStep] = useState('select');
  const [customValue, setCustomValue] = useState('');

  const [direction, setDirection] = useState(1);

  useStepSheetHeight(
    setContentHeight,
    step === 'custom' ? CUSTOM_HEIGHT : SELECT_HEIGHT,
  );

  const perGiftAmount = formatGiftAmount({
    gift: { denomination: giftDenomination, dollarAmount, amount },
    masterInfoObject,
    fiatStats,
  });

  const currentDerivedGiftIndex = masterInfoObject.currentDerivedGiftIndex || 1;

  const handleBackPress = useCallback(() => {
    if (step === 'custom') {
      setDirection(-1);
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

    handleBackPressFunction(() =>
      navigate.popTo('GiftsStack', {
        screen: 'CreateGiftDescription',
        params: {
          amount,
          amountValue,
          dollarAmount,
          giftDenomination,
          giftQuantity: clampedQty,
        },
      }),
    );
  };

  const handleCustomContinue = () => {
    const qty = parseInt(customValue, 10);
    if (!qty || qty <= 0) return;
    validateAndProceed(qty);
  };

  const openCustom = () => {
    setDirection(1);
    growThenStep(setContentHeight, SELECT_HEIGHT, CUSTOM_HEIGHT, () =>
      setStep('custom'),
    );
  };

  const items = [...GIFTS_QUANTITY_PRESETS, null];
  const customQty = parseInt(customValue, 10) || 0;
  const isValid = customQty >= 1 && customQty <= MAX_GIFT_QUANTITY;

  return (
    <View style={[styles.container, { width: contentWidth }]}>
      <AnimatedStep active={step === 'select'} direction={direction}>
        <ThemeText
          styles={styles.title}
          content={t('screens.inAccount.giftPages.createGift.quantityHeader')}
        />
        <ThemeText
          styles={[styles.sub, { color: tokens.muted }]}
          content={t('screens.inAccount.giftPages.createGift.quantitySub', {
            amount: perGiftAmount,
            max: MAX_GIFT_QUANTITY,
          })}
        />
        <View style={styles.grid}>
          {items.map(value => (
            <TouchableOpacity
              key={value ?? 'other'}
              activeOpacity={0.7}
              onPress={() => (value ? validateAndProceed(value) : openCustom())}
              style={[styles.preset, { backgroundColor: tokens.ground }]}
            >
              <ThemeText
                styles={styles.presetText}
                content={
                  value
                    ? String(value)
                    : t('screens.inAccount.giftPages.createGift.quantityOther')
                }
              />
            </TouchableOpacity>
          ))}
        </View>
      </AnimatedStep>

      <AnimatedStep active={step === 'custom'} direction={direction} exitsBack>
        <TopBar onBack={handleBackPress} />
        <View style={styles.inputContainer}>
          <ThemeText
            styles={[
              styles.quantityDisplay,
              customValue ? null : { color: tokens.muted },
            ]}
            content={t('screens.inAccount.giftPages.createGift.quantityCount', {
              count: customQty,
            })}
          />
        </View>
        <ThemeText
          styles={[styles.maxGiftHint, { color: tokens.muted }]}
          content={t('screens.inAccount.giftPages.createGift.quantityMaxHint', {
            amount: perGiftAmount,
            max: MAX_GIFT_QUANTITY,
          })}
        />
        <CustomNumberKeyboard
          showDot={false}
          redesign
          customFunction={val => {
            const num = parseInt(val, 10);
            if (!num && num !== 0) {
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
          disabled={!isValid}
          size="regular"
          textContent={t('constants.continue')}
          actionFunction={handleCustomContinue}
        />
      </AnimatedStep>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  title: {
    marginTop: 20,
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
  },
  sub: {
    marginTop: 4,
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  grid: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  preset: {
    width: '48.5%',
    flexGrow: 1,
    minHeight: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  presetText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 16,
    lineHeight: 22,
    includeFontPadding: false,
  },
  inputContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  quantityDisplay: {
    fontFamily: FONT.Title_Medium,
    fontSize: 40,
    lineHeight: 48,
    includeFontPadding: false,
    pointerEvents: 'none',
    textAlign: 'center',
  },
  maxGiftHint: {
    textAlign: 'center',
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    includeFontPadding: false,
  },
  button: {
    marginTop: 12,
  },
});
