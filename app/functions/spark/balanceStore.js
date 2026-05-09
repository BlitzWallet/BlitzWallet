let _dollarBalanceToken = 0;
let _bitcoinBalance = 0;

export const setDollarBalanceToken = val => {
  _dollarBalanceToken = val;
};
export const getDollarBalanceToken = () => _dollarBalanceToken;

export const setBitcoinBalance = val => {
  _bitcoinBalance = val;
};
export const getBitcoinBalance = () => _bitcoinBalance;
