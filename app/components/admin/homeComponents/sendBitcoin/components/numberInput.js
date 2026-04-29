import { useCallback } from 'react';
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
  const decimals = seletctedToken?.tokenMetadata?.decimals;
  const amount = paymentInfo?.sendAmount;

  const handleSetAmount = useCallback(
    newAmountOrUpdater => {
      setPaymentInfo(prev => {
        const newAmount =
          typeof newAmountOrUpdater === 'function'
            ? newAmountOrUpdater(prev.sendAmount)
            : newAmountOrUpdater;
        return {
          ...prev,
          sendAmount: newAmount,
          feeQuote: undefined,
          swapPaymentQuote: undefined,
          paymentFee: 0,
          supportFee: 0,
        };
      });
    },
    [setPaymentInfo],
  );

  const lrc20InputFunction = useCallback(
    input => {
      if (input === null) {
        const newAmount = String(amount).slice(0, -1);
        handleSetAmount(newAmount);
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

        handleSetAmount(newNumber);
      }
    },
    [amount, decimals, handleSetAmount],
  );

  return (
    <CustomNumberKeyboard
      showDot={
        (inputDenomination === 'fiat' && selectedLRC20Asset === 'Bitcoin') ||
        selectedLRC20Asset !== 'Bitcoin' ||
        primaryDisplay.denomination === 'fiat'
      }
      setInputValue={handleSetAmount}
      usingForBalance={true}
      fiatStats={fiatStats}
      useMaxBalance={selectedLRC20Asset === 'Bitcoin'}
      customFunction={
        selectedLRC20Asset !== 'Bitcoin' ? lrc20InputFunction : null
      }
    />
  );
}
