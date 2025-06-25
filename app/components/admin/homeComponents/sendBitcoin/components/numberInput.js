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
    setPaymentInfo(prev => {
      return {...prev, sendAmount: amount};
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
