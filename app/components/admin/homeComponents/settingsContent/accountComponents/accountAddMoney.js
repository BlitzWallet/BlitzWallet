import AccountTransferHalfModal from './AccountTransferHalfModal';

export default function AddMoney({
  to,
  handleBackPressFunction,
  setBackNav,
  setContentHeight,
}) {
  return (
    <AccountTransferHalfModal
      mode="add"
      currentAccountUuid={to}
      handleBackPressFunction={handleBackPressFunction}
      setBackNav={setBackNav}
      setContentHeight={setContentHeight}
    />
  );
}
