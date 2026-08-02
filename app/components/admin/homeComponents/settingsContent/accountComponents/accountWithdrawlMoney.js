import AccountTransferHalfModal from './AccountTransferHalfModal';

export default function WithdrawlMoney({
  from,
  balance,
  handleBackPressFunction,
  setBackNav,
  setContentHeight,
}) {
  return (
    <AccountTransferHalfModal
      mode="withdraw"
      currentAccountUuid={from}
      currentBalance={balance}
      handleBackPressFunction={handleBackPressFunction}
      setBackNav={setBackNav}
      setContentHeight={setContentHeight}
    />
  );
}
