export function sumProofsValue(proofs) {
  return proofs.reduce((r, c) => {
    return r + c.amount;
  }, 0);
}
