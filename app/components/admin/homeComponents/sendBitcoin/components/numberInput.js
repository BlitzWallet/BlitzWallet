import { useCallback, useEffect, useState } from 'react';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';

export default function NumberInputSendPage({
  setPaymentInfo,
  paymentInfo,
  fiatStats,
  selectedLRC20Asset,
  seletctedToken,
  inputDenomination,
  primaryDisplay,
}) {
  const [amount, setAmount] = useState(paymentInfo?.sendAmount);
  const decimals = seletctedToken?.tokenMetadata?.decimals;

  useEffect(() => {
    setPaymentInfo(prev => {
      return {
        ...prev,
        sendAmount: amount,
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

        // Add leading 0 if starting with decimal point
        if (newNumber.startsWith('.')) {
          newNumber = '0' + newNumber;
        }

        // Remove leading zeros before digits
        newNumber = newNumber.replace(/^(-?)0+(?=\d)/, '$1');

        setAmount(newNumber);
      }
    },
    [amount, decimals],
  );

  return (
    <CustomNumberKeyboard
      showDot={
        (inputDenomination === 'fiat' && selectedLRC20Asset === 'Bitcoin') ||
        selectedLRC20Asset !== 'Bitcoin' ||
        primaryDisplay.denomination === 'fiat'
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
