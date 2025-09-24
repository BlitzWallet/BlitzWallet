import {useCallback, useEffect, useState} from 'react';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import {useGlobalContextProvider} from '../../../../../../context-store/context';

export default function NumberInputSendPage({
  setPaymentInfo,
  paymentInfo,
  fiatStats,
  selectedLRC20Asset,
  seletctedToken,
}) {
  const {masterInfoObject} = useGlobalContextProvider();
  const [amount, setAmount] = useState(paymentInfo?.sendAmount);
  const decimals = seletctedToken?.tokenMetadata?.decimals;

  useEffect(() => {
    let value = amount.trim();

    if (value.startsWith('.')) {
      value = '0' + value;
    }
    value = value.replace(/^(-?)0+(?=\d)/, '$1'); //only have at max 1 leading 0. If a number comes then remove the 0 and replace with number

    setPaymentInfo(prev => {
      return {
        ...prev,
        sendAmount: value,
        feeQuote: undefined,
        paymentFee: 0,
        supportFee: 0,
      };
    });
  }, [amount]);

  // Effect to update amount when paymentInfo.sendAmount changes
  useEffect(() => {
    if (paymentInfo?.sendAmount !== amount) {
      setAmount(paymentInfo.sendAmount);
    }
  }, [paymentInfo?.sendAmount]);

  const lrc20InputFunction = useCallback(
    input => {
      if (input === null) {
        const newAmount = String(amount).slice(0, -1);
        setAmount(newAmount);
      } else {
        let newNumber = '';
        if (amount?.includes('.') && input === '.') {
          newNumber = amount;
        } else if (
          amount?.includes('.') &&
          amount.split('.')[1].length >= decimals
        ) {
          newNumber = amount;
        } else {
          newNumber = String(amount) + input;
        }
        setAmount(newNumber);
      }
    },
    [amount],
  );

  return (
    <CustomNumberKeyboard
      showDot={
        (masterInfoObject.userBalanceDenomination === 'fiat' &&
          selectedLRC20Asset === 'Bitcoin') ||
        selectedLRC20Asset !== 'Bitcoin'
      }
      setInputValue={setAmount}
      usingForBalance={true}
      fiatStats={fiatStats}
      useMaxBalance={selectedLRC20Asset === 'Bitcoin'}
      customFunction={
        selectedLRC20Asset !== 'Bitcoin' ? lrc20InputFunction : null
      }
    />
  );
}
