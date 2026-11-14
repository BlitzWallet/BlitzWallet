const RN_METHOD = [
  'lightning',
  'spark',
  'token',
  'deposit',
  'withdraw',
  'unknown',
];
const RN_STATUS = ['completed', 'pending', 'failed'];
const RN_TYPE = ['send', 'receive'];

const big = v => (typeof v === 'bigint' ? v : BigInt(v ?? 0));
const num = v => (typeof v === 'number' ? v : Number(v));

function tokenMeta(m) {
  return {
    identifier: m.identifier,
    issuerPublicKey: m.issuerPublicKey,
    name: m.name,
    ticker: m.ticker,
    decimals: Number(m.decimals),
    maxSupply: big(m.maxSupply),
    isFreezable: !!m.isFreezable,
  };
}

function normalizeDetails(d, rn) {
  if (!d) return null;
  if (!rn) return d;
  switch (d.tag) {
    case 'Spark':
      return {
        type: 'spark',
        invoiceDetails: d.inner.invoiceDetails,
        htlcDetails: d.inner.htlcDetails,
        conversionInfo: d.inner.conversionInfo,
      };
    case 'Token':
      return {
        type: 'token',
        metadata: tokenMeta(d.inner.metadata),
        txHash: d.inner.txHash,
        txType: d.inner.txType,
        invoiceDetails: d.inner.invoiceDetails,
        conversionInfo: d.inner.conversionInfo,
      };
    case 'Lightning':
      return { type: 'lightning', ...d.inner };
    case 'Withdraw':
      return { type: 'withdraw', ...d.inner };
    case 'Deposit':
      return { type: 'deposit', ...d.inner };
    default:
      return null;
  }
}

export function normalizePayment(p, rn = true) {
  if (!p) return null;
  return {
    id: p.id,
    paymentType: rn ? RN_TYPE[p.paymentType] : p.paymentType,
    status: rn ? RN_STATUS[p.status] : p.status,
    amount: big(p.amount),
    fees: big(p.fees),
    timestamp: num(p.timestamp),
    method: rn ? RN_METHOD[p.method] : p.method,
    details: normalizeDetails(p.details, rn),
    conversionDetails: p.conversionDetails,
  };
}

export function normalizeInfo(info) {
  const tokens = new Map();
  for (const [id, tb] of info.tokenBalances || []) {
    tokens.set(id, {
      balance: big(tb.balance),
      tokenMetadata: tokenMeta(tb.tokenMetadata),
    });
  }
  return {
    identityPubkey: info.identityPubkey,
    balanceSats: big(info.balanceSats),
    tokenBalances: tokens,
    recoverableFundsSats: big(info.recoverableFundsSats),
  };
}

// RN events are tagged classes ({ tag, inner }); WASM events are plain
// ({ type, ...fields }). Both come out as { type, ...fields } with the same
// field names (payment, deposits, sats).
export function normalizeEvent(e, rn = true) {
  if (!e) return null;
  const i = rn ? e.inner : e;
  const type = String(rn ? e.tag : e.type);
  const key = type[0].toLowerCase() + type.slice(1);
  const pay = () => ({ payment: normalizePayment(i.payment, rn) });
  switch (key) {
    case 'synced':
    case 'unilateralExitStateChanged':
    case 'lightningAddressChanged':
      return { type: key };
    case 'paymentSucceeded':
    case 'paymentPending':
    case 'paymentFailed':
    case 'paymentMetadataUpdated':
      return { type: key, ...pay() };
    case 'claimedDeposits':
    case 'unclaimedDeposits':
    case 'newDeposits':
      return { type: key, deposits: i[key] };
    case 'autoOptimization':
      return { type: key, optimizationEvent: i.optimizationEvent };
    case 'recoverableFunds':
      return { type: key, sats: big(i.recoverableFundsSats) };
    case 'stableBalanceConversionFailed':
      return { type: 'stableBalanceFailed' };
    default:
      return null;
  }
}

export function legacyTransfer(p) {
  return {
    id: p.id,
    status: p.status,
    type:
      p.method === 'lightning'
        ? 'PREIMAGE_SWAP'
        : p.method === 'withdraw'
        ? 'COOPERATIVE_EXIT'
        : p.method === 'deposit'
        ? 'UTXO_SWAP'
        : 'TRANSFER',
    totalValue: Number(p.amount),
    transferDirection: p.paymentType === 'send' ? 'OUTGOING' : 'INCOMING',
    senderIdentityPublicKey: '',
    receiverIdentityPublicKey: '',
    createdTime: new Date(Number(p.timestamp) * 1000),
    updatedTime: new Date(Number(p.timestamp) * 1000),
    leaves: undefined,
  };
}

export function legacyLightningSend(p) {
  return {
    id: p.id,
    fee: {
      originalValue: Number(p.fees),
      originalUnit: 'SATOSHI',
    },
    createdAt: new Date(Number(p.timestamp) * 1000),
    updatedAt: new Date(Number(p.timestamp) * 1000),
    status: p.status,
    type: p.method === 'spark' ? 'TRANSFER' : undefined,
  };
}

// RN tagged union ({ tag, inner }) -> WASM-style ({ type, ...fields }).
// bigint -> number: deposit/claim amounts are sats, far below 2^53.
const plain = (t, rn) => {
  if (!t) return null;
  const flat =
    rn && t.tag
      ? { type: t.tag[0].toLowerCase() + t.tag.slice(1), ...t.inner }
      : t;
  return Object.fromEntries(
    Object.entries(flat).map(([k, v]) => [
      k,
      typeof v === 'bigint' ? Number(v) : v,
    ]),
  );
};

const normalizeQuote = q =>
  q
    ? {
        confirmationsRequired: Number(q.confirmationsRequired),
        creditAmountSats: Number(q.creditAmountSats),
        feeSats: Number(q.feeSats),
        maxFeeSats: q.maxFeeSats == null ? null : Number(q.maxFeeSats),
        isEstimate: !!q.isEstimate,
      }
    : null;

// -> [{ txid, vout, amountSats, isMature, refundTxId, claimError }]
export function normalizeDeposits(res, rn = true) {
  return (res?.deposits || []).map(d => ({
    txid: d.txid,
    vout: Number(d.vout),
    amountSats: Number(d.amountSats),
    isMature: !!d.isMature,
    refundTxId: d.refundTxId ?? null,
    claimError: plain(d.claimError, rn),
  }));
}

// -> { amountSats, confirmations, instant: quote|null, mature: quote }
export function normalizeClaimQuote(res, rn = true) {
  return {
    amountSats: Number(res.amountSats),
    confirmations: Number(res.confirmations),
    instant: normalizeQuote(res.instant),
    mature: normalizeQuote(res.mature),
  };
}

// -> { type: 'settled', payment } | { type: 'submitted' }
//    | { type: 'deferred', reason: { type, ...fields } }
export function normalizeClaimOutcome(res, rn = true) {
  const o = plain(res.outcome, rn);
  if (o.type === 'settled') {
    const raw = rn ? res.outcome.inner.payment : res.outcome.payment;
    return { type: 'settled', payment: normalizePayment(raw, rn) };
  }
  if (o.type === 'deferred') {
    const raw = rn ? res.outcome.inner.reason : res.outcome.reason;
    return { type: 'deferred', reason: plain(raw, rn) };
  }
  return { type: 'submitted' };
}

// prepareRecoverFunds quote -> plain numbers. `receiveSats` is what lands at
// the destination; `fundingSats` must come from an outside UTXO (CPFP), zero
// when every leaf recovers cooperatively.
export function normalizeRecoverPreview(p, rn = true) {
  const methods = p.leaves.map(l =>
    rn ? (l.method === 1 ? 'unilateral' : 'cooperative') : l.method,
  );
  const recoverableSats = num(p.recoverableValueSats);
  const fromLeavesSats =
    num(p.cooperativeFeeSats) + num(p.refundFeeSats) + num(p.sweepFeeSats);
  return {
    recoverableSats,
    receiveSats: Math.max(recoverableSats - fromLeavesSats, 0),
    totalFeeSats: num(p.totalFeeSats),
    fundingSats: p.funding ? num(p.funding.singleUtxoSats) : 0,
    cooperativeCount: methods.filter(m => m === 'cooperative').length,
    unilateralCount: methods.filter(m => m === 'unilateral').length,
    skipped: p.skipped.map(s => ({
      valueSats: num(s.valueSats),
      reason: rn
        ? s.reason.tag.charAt(0).toLowerCase() + s.reason.tag.slice(1)
        : s.reason.type,
    })),
  };
}
