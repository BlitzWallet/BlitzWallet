import { useRef, useState } from 'react';
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
  const navigate = useNavigation();
  const { swapUSDPriceDollars, poolInfoRef } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats: globalFiatStats } = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const initialValue = useRef(0);
  const [inputDenomination, setInputDenomination] = useState(
    props.forceUSD
      ? 'fiat'
      : masterInfoObject.userBalanceDenomination != 'fiat'
      ? 'sats'
      : 'fiat',
  );
  const forceUSD = props.forceUSD;
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
    props.handleBackPressFunction(() => {
      if (props?.passedParams) {
        navigate.popTo(props.returnLocation, {
          ...props?.passedParams,
          amount: !amountValue ? 0 : localSatAmount,
          type: props.type,
        });
      } else {
        navigate.popTo(
          props.returnLocation,
          {
            amount: !amountValue ? 0 : localSatAmount,
            type: props?.type,
          },
          {
            merge: true,
          },
        );
      }
    });
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      onContentSizeChange={(contentWidth, contentHeight) => {
        // Get the actual content height
        if (!initialValue.current) {
          initialValue.current = contentHeight;
          props.setContentHeight(contentHeight + 90);
        }
      }}
    >
      {props.message && (
        <ThemeText
          styles={{ textAlign: 'center', width: '80%', ...CENTER }}
          content={props.message}
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

  textInputContainer: {
    width: '95%',
  },
  textInputStyles: {
    width: '90%',
    includeFontPadding: false,
  },
});
