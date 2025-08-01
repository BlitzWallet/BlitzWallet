import {useRef, useState} from 'react';
import {useGlobalContextProvider} from '../../../context-store/context';
import {useNavigation} from '@react-navigation/native';
import {useNodeContext} from '../../../context-store/nodeContext';
import {CENTER, SATSPERBITCOIN} from '../../constants';
import FormattedBalanceInput from './formattedBalanceInput';
import FormattedSatText from './satTextDisplay';
import CustomNumberKeyboard from './customNumberKeyboard';
import CustomButton from './button';
import {
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import ThemeText from './textTheme';

export default function CustomInputHalfModal(props) {
  const navigate = useNavigation();
  const {masterInfoObject} = useGlobalContextProvider();
  const {fiatStats} = useNodeContext();
  const [amountValue, setAmountValue] = useState('');
  const initialValue = useRef(0);
  const [inputDenomination, setInputDenomination] = useState(
    masterInfoObject.userBalanceDenomination != 'fiat' ? 'sats' : 'fiat',
  );
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
    if (!amountValue) {
      return;
    }
    if (props?.passedParams) {
      navigate.popTo(props.returnLocation, {
        ...props?.passedParams,
        amount: localSatAmount,
        type: props.type,
      });
    } else {
      navigate.popTo(props.returnLocation, {
        amount: localSatAmount,
        type: props.type,
      });
    }
  };

  return (
    <TouchableWithoutFeedback>
      <ScrollView
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(contentWidth, contentHeight) => {
          // Get the actual content height
          if (!initialValue.current) {
            initialValue.current = contentHeight;
            props.setContentHeight(contentHeight + 90);
          }
        }}>
        {props.message && (
          <ThemeText
            styles={{textAlign: 'center', width: '80%', ...CENTER}}
            content={props.message}
          />
        )}
        <FormattedBalanceInput
          maxWidth={0.9}
          amountValue={amountValue}
          inputDenomination={inputDenomination}
          customTextInputContainerStyles={{
            padding: 10,
          }}
          containerFunction={() => {
            setInputDenomination(prev => {
              const newPrev = prev === 'sats' ? 'fiat' : 'sats';

              return newPrev;
            });
            setAmountValue(convertedValue() || '');
          }}
        />

        <FormattedSatText
          containerStyles={{opacity: !amountValue ? 0.5 : 1}}
          neverHideBalance={true}
          styles={{includeFontPadding: false, ...styles.satValue}}
          globalBalanceDenomination={
            inputDenomination === 'sats' ? 'fiat' : 'sats'
          }
          balance={localSatAmount}
        />
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
          textContent={'Save'}
        />
      </ScrollView>
    </TouchableWithoutFeedback>
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
