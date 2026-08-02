import AccountTransferHalfModal from './AccountTransferHalfModal';

export default function AddMoney({
  to,
  handleBackPressFunction,
  setBackNav,
  setContentHeight,
  onTransferComplete,
  balance,
}) {
  return (
    <AccountTransferHalfModal
      mode="add"
      currentAccountUuid={to}
      currentBalance={balance}
      handleBackPressFunction={handleBackPressFunction}
      setBackNav={setBackNav}
      setContentHeight={setContentHeight}
      onTransferComplete={onTransferComplete}
    />
  );
}
