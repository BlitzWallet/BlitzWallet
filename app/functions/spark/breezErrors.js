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

function messageOf(error) {
  if (!error) return 'Unknown error';
  const inner = error.inner;
  const innerMsg = Array.isArray(inner)
    ? inner[0]
    : inner && typeof inner === 'object'
    ? inner.message || inner.reason
    : undefined;
  return String(error.message || innerMsg || error);
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

  return {
    kind,
    message,
    docsUrl: error?.docsUrl,
    tag,
    isFatalWasm: isWasmTrap(error),
  };
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
