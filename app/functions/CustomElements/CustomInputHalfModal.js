import { useEffect, useRef, useState } from 'react';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useNavigation } from '@react-navigation/native';
import { useNodeContext } from '../../../context-store/nodeContext';
import { CENTER, SATSPERBITCOIN } from '../../constants';
import FormattedBalanceInput from './formattedBalanceInput';
import FormattedSatText from './satTextDisplay';
import CustomNumberKeyboard from './customNumberKeyboard';
import CustomButton from './button';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import ThemeText from './textTheme';
import { useTranslation } from 'react-i18next';
import { HIDDEN_OPACITY } from '../../constants/theme';
import { useFlashnet } from '../../../context-store/flashnetContext';
import formatBalanceAmount from '../formatNumber';
import { satsToDollars } from '../spark/flashnet';

export default function CustomInputHalfModal(props) {
  const {
    handleBackPressFunction,
    theme,
    darkModeType,
    slideHeight,
    setContentHeight,
    message,
    type,
    returnLocation,
    passedParams,
    forceUSD,
  } = props;
  const navigate = useNavigation();
  const { swapUSDPriceDollars, poolInfoRef } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats: globalFiatStats } = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const initialValue = useRef(0);
  const [inputDenomination, setInputDenomination] = useState(
    forceUSD
      ? 'fiat'
      : masterInfoObject.userBalanceDenomination != 'fiat'
      ? 'sats'
      : 'fiat',
  );
  const fiatStats = forceUSD
    ? { value: swapUSDPriceDollars, coin: 'USD' }
    : globalFiatStats;

  const { t } = useTranslation();
  const localSatAmount =
    inputDenomination === 'sats'
      ? Number(amountValue)
      : Math.round(SATSPERBITCOIN / (fiatStats?.value || 65000)) * amountValue;

  const convertedValue = () =>
    !amountValue
      ? ''
      : inputDenomination === 'fiat'
      ? String(
          Math.round(
            (SATSPERBITCOIN / (fiatStats?.value || 65000)) *
              Number(amountValue),
          ),
        )
      : String(
          (
            ((fiatStats?.value || 65000) / SATSPERBITCOIN) *
            Number(amountValue)
          ).toFixed(2),
        );
  const handleSubmit = () => {
    handleBackPressFunction(() => {
      if (props?.passedParams) {
        navigate.popTo(returnLocation, {
          ...props?.passedParams,
          amount: !amountValue ? 0 : localSatAmount,
          type: type,
        });
      } else {
        navigate.popTo(
          returnLocation,
          {
            amount: !amountValue ? 0 : localSatAmount,
            amountValue:
              forceUSD && inputDenomination !== 'sats'
                ? amountValue
                : satsToDollars(
                    localSatAmount,
                    poolInfoRef.currentPriceAInB,
                  ).toFixed(2),
            type: props?.type,
          },
          {
            merge: true,
          },
        );
      }
    });
  };

  useEffect(() => {
    // Set content at fixed height
    setContentHeight(600);
  }, []);

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      {message && (
        <ThemeText
          styles={{ textAlign: 'center', width: '80%', ...CENTER }}
          content={message}
        />
      )}
      <TouchableOpacity
        style={{ marginTop: 10 }}
        activeOpacity={1}
        onPress={() => {
          setInputDenomination(prev => {
            const newPrev = prev === 'sats' ? 'fiat' : 'sats';

            return newPrev;
          });
          setAmountValue(convertedValue() || '');
        }}
      >
        <FormattedBalanceInput
          maxWidth={0.9}
          amountValue={amountValue}
          inputDenomination={inputDenomination}
          forceCurrency={forceUSD ? 'USD' : ''}
        />

        {forceUSD ? (
          <FormattedSatText
            containerStyles={{ opacity: !amountValue ? HIDDEN_OPACITY : 1 }}
            neverHideBalance={true}
            styles={{ includeFontPadding: false, ...styles.satValue }}
            globalBalanceDenomination={
              inputDenomination === 'sats' ? 'fiat' : 'sats'
            }
            balance={
              inputDenomination === 'sats'
                ? formatBalanceAmount(
                    satsToDollars(
                      localSatAmount,
                      poolInfoRef.currentPriceAInB,
                    ).toFixed(2),
                    false,
                    masterInfoObject,
                  )
                : localSatAmount
            }
            forceCurrency={'USD'}
            useBalance={inputDenomination === 'sats'}
          />
        ) : (
          <FormattedSatText
            containerStyles={{ opacity: !amountValue ? HIDDEN_OPACITY : 1 }}
            neverHideBalance={true}
            styles={{ includeFontPadding: false, ...styles.satValue }}
            globalBalanceDenomination={
              inputDenomination === 'sats' ? 'fiat' : 'sats'
            }
            balance={localSatAmount}
          />
        )}
      </TouchableOpacity>
      <CustomNumberKeyboard
        showDot={inputDenomination === 'fiat'}
        setInputValue={setAmountValue}
        usingForBalance={true}
        fiatStats={fiatStats}
      />
      <CustomButton
        buttonStyles={{
          ...CENTER,
        }}
        actionFunction={handleSubmit}
        textContent={t('constants.save')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  popupContainer: {
    flex: 1,
  },
  satValue: {
    textAlign: 'center',
    marginBottom: 50,
  },
});
