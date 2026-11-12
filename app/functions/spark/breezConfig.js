export const BREEZ_SYNC_INTERVAL_SECS = 60;

export const getBreezApiKey = () => process.env.LIQUID_BREEZ_KEY || '';

export function applyBlitzConfig(base, mode = 'client') {
  if (!base) throw new Error('Breez config base missing');
  const config = {
    ...base,
    apiKey: getBreezApiKey(),
    syncIntervalSecs: BREEZ_SYNC_INTERVAL_SECS,
    // Blitz owns claims (depositClaim.js). undefined disables auto-claim.
    maxDepositClaimFee: undefined,
    // Blitz owns lightning addresses / LNURL.
    lnurlDomain: undefined,
    // No third-party metadata sync.
    realTimeSyncServerUrl: undefined,
    // Do not ship scanned input to cryptoqr.net.
    useDefaultExternalInputParsers: false,
    externalInputParsers: undefined,
    // Client mode: keep today's privacy default. Server mode: do not mutate.
    privateEnabledDefault: mode === 'client',
    leafOptimizationConfig: {
      ...base.leafOptimizationConfig,
      autoEnabled: mode === 'client',
      multiplicity: 2,
    },
    tokenOptimizationConfig: {
      ...base.tokenOptimizationConfig,
      autoEnabled: mode === 'client',
    },
    // Blitz has its own conversion stack.
    stableBalanceConfig: undefined,
  };
  // Only the WASM Config has crossChainConfig (absent from the RN Config).
  if ('crossChainConfig' in base) config.crossChainConfig = undefined;
  return config;
}

export function storageRootFromDocumentDir(documentDirectory) {
  if (!documentDirectory) throw new Error('documentDirectory unavailable');
  return `${decodeURIComponent(
    documentDirectory.replace(/^file:\/\//, ''),
  )}breez/`;
}
