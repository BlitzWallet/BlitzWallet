const RN_TAGS = {
  InsufficientFunds: 'insufficientFunds',
  InvalidUuid: 'invalidInput',
  InvalidInput: 'invalidInput',
  NetworkError: 'network',
  StorageError: 'storage',
  ChainServiceError: 'chainService',
  MaxDepositClaimFeeExceeded: 'claimFeeTooHigh',
  MissingUtxo: 'missingUtxo',
  DepositTooSmall: 'depositTooSmall',
  DepositClaimInProgress: 'claimInProgress',
  RefundReplacementFeeTooLow: 'refundFeeTooLow',
  LnurlError: 'lnurl',
  Signer: 'signer',
  OptimizationAlreadyRunning: 'optimizationRunning',
  OptimizationCancelled: 'optimizationCancelled',
  InsufficientCpfpFunds: 'insufficientCpfp',
  TokenAllowance: 'tokenAllowance',
  SparkError: 'sparkError',
  Generic: 'generic',
};

// RN errors set `message` to the placeholder 'SdkError.<Variant>' and carry the
// SDK's text in `inner` (inner[0] for tuple variants, inner.message/reason for
// records); the text wins over the placeholder. WASM errors and app-made errors
// have a real `message` and keep it.
const RN_PLACEHOLDER = /^SdkError\.\w+$/;

function messageOf(error) {
  if (!error) return 'Unknown error';
  const inner = error.inner;
  const innerMsg = Array.isArray(inner)
    ? inner[0]
    : inner && typeof inner === 'object'
    ? inner.message || inner.reason
    : undefined;
  const placeholder = RN_PLACEHOLDER.test(String(error.message));
  return String(
    (placeholder && innerMsg) || error.message || innerMsg || error,
  );
}

// Hermes has no WebAssembly global.
const isWasmTrap = error => {
  const W = globalThis.WebAssembly;
  return (
    typeof W !== 'undefined' &&
    (error instanceof W.RuntimeError || error instanceof W.CompileError)
  );
};

export function classifyBreezError(error) {
  const message = messageOf(error);
  const tag = error?.tag || error?.name;
  let kind = RN_TAGS[tag];

  if (!kind) {
    if (/^Insufficient funds/i.test(message)) kind = 'insufficientFunds';
    else if (/^Invalid input:/i.test(message)) kind = 'invalidInput';
    else if (/^Invalid UUID/i.test(message)) kind = 'invalidInput';
    else if (/^Network error:/i.test(message)) kind = 'network';
    else if (/^Storage error:/i.test(message)) kind = 'storage';
    else if (/^SparkSdkError:/i.test(message)) kind = 'sparkError';
    else if (/^Error:/i.test(message)) kind = 'generic';
    else kind = 'unknown';
  }

  if (
    kind === 'sparkError' &&
    /^Tree service error: insufficient funds$/.test(message)
  ) {
    kind = 'insufficientFunds';
  }

  return {
    kind,
    message,
    docsUrl: error?.docsUrl,
    tag,
    isFatalWasm: isWasmTrap(error),
  };
}

// getPayment on an id Breez does not hold. Native and web report it as a
// storage error ("Query returned no rows" / "Payment with id '<id>' not
// found"), not invalidInput; matched exactly so other storage faults still
// throw. invalidInput "not found" is Breez's mapping of StorageError::NotFound.
// RN errors carry the text in `inner` ({ message: 'SdkError.StorageError',
// inner: ['Underlying implementation error: Query returned no rows'] }).
export function isMissingPaymentError(error) {
  const c = classifyBreezError(error);
  const text = [c.message, ...[].concat(error?.inner ?? [])].join(' ');
  return (
    (c.kind === 'storage' &&
      /Query returned no rows|Payment with id '[^']*' not found/.test(text)) ||
    (c.kind === 'invalidInput' && /not found/i.test(text))
  );
}

// Kinds that prove the SDK refused before anything was sent.
const DEFINITIVE_SEND_FAILURES = new Set([
  'insufficientFunds',
  'invalidInput',
  'claimFeeTooHigh',
  'missingUtxo',
  'depositTooSmall',
  'claimInProgress',
  'refundFeeTooLow',
]);

export function isDefinitiveSendFailure(error) {
  return DEFINITIVE_SEND_FAILURES.has(classifyBreezError(error).kind);
}

export function asSendResult(error, extra = {}) {
  const c = classifyBreezError(error);
  return {
    didWork: false,
    error: c.message,
    outcome: DEFINITIVE_SEND_FAILURES.has(c.kind) ? 'failed' : 'unknown',
    ...extra,
  };
}
