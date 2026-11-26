// Breez pays whole sats and rounds a sub-sat invoice amount UP
// (`amount_msat.div_ceil(1000)` in spark-sdk prepare/bolt11.rs). Use this for
// any amount we show, check or record for a payment Breez makes.
export const msatToPaidSats = msat => Math.ceil(Number(msat) / 1000);
