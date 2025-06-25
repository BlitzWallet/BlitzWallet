import {SATSPERBITCOIN} from '../constants';

const convertTextInputValue = (amountValue, fiatStats, inputDenomination) => {
  try {
    return !amountValue
      ? ''
      : inputDenomination === 'fiat'
      ? String(
          Math.round(
            (SATSPERBITCOIN / (fiatStats?.value || 80_000)) *
              Number(amountValue),
          ),
        )
      : String(
          (
            ((fiatStats?.value || 80_000) / SATSPERBITCOIN) *
            Number(amountValue)
          ).toFixed(2),
        );
  } catch (err) {
    console.log('Converting value erorr', err);
    return '';
  }
};

export default convertTextInputValue;
