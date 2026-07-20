import { decode as lightDecode } from 'light-bolt11-decoder';

// Drop-in replacement for the slice of the `bolt11` package this app used:
// `.satoshis`, `.millisatoshis`, and `.tags` ([{ tagName, data }], looked up for
// 'payment_hash' and 'description'). Backed by light-bolt11-decoder so we shed
// bolt11's heavy lodash/bn.js/elliptic/secp256k1 dependency chain.
//
// satoshis mirrors bolt11 exactly: integer sats when the msat amount is a whole
// number of sats, otherwise null (and null when the invoice omits an amount).
export function decode(paymentRequest) {
  const { sections } = lightDecode(paymentRequest);

  const amount = sections.find(s => s.name === 'amount');
  const millisatoshis = amount ? amount.value : null; // string, like bolt11
  const msat = millisatoshis == null ? null : Number(millisatoshis);
  const satoshis = msat != null && msat % 1000 === 0 ? msat / 1000 : null;

  const tags = sections
    .filter(s => s.name && s.value !== undefined)
    .map(s => ({ tagName: s.name, data: s.value }));

  return { paymentRequest, satoshis, millisatoshis, tags };
}

export default { decode };
