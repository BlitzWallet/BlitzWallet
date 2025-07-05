import {useEffect, useState} from 'react';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import {useGlobalContextProvider} from '../../../../../../context-store/context';

export default function NumberInputSendPage({
  setPaymentInfo,
  paymentInfo,
  fiatStats,
}) {
  const {masterInfoObject} = useGlobalContextProvider();
  const [amount, setAmount] = useState(paymentInfo?.sendAmount);

  useEffect(() => {
    console.log(amount, 'amount input');

    let value = amount.trim();

    if (value.startsWith('.')) {
      value = '0' + value;
    }
    value = value.replace(/^(-?)0+(?=\d)/, '$1'); //only have at max 1 leading 0. If a number comes then remove the 0 and replace with number

    setPaymentInfo(prev => {
      return {...prev, sendAmount: value};
    });
  }, [amount]);

  // Effect to update amount when paymentInfo.sendAmount changes
  useEffect(() => {
    if (paymentInfo?.sendAmount !== amount) {
      setAmount(paymentInfo.sendAmount);
    }
  }, [paymentInfo?.sendAmount]);

  return (
    <CustomNumberKeyboard
      showDot={masterInfoObject.userBalanceDenomination === 'fiat'}
      setInputValue={setAmount}
      usingForBalance={true}
      fiatStats={fiatStats}
    />
  );
}
