// hold ⟺ non-send decrease whose owned still covers the displayed balance
// Optimization dip (any device): available down, owned unchanged → hold
// Cross-device real spend: owned drops → commit (conservative available)
// Same-device send: isSending bypass → commit
// Missing/non-finite owned → commit (land decrease rather than strand spend)
export const shouldHoldBalanceDecrease = ({
  nextAvailable,
  nextOwned,
  displayed,
  isSending,
}) =>
  nextAvailable < displayed &&
  !isSending &&
  Number.isFinite(nextOwned) &&
  nextOwned >= displayed;
