/**
 * Lazy loader for @buildonspark/spark-sdk — native runtime only.
 *
 * The WebView path (default) must never evaluate the SDK bundle
 * (4.6 MB + WASM). Every native code path goes through this module,
 * which does a single cached dynamic `import()` so Metro defers
 * parsing/compilation until `getIsNativeRuntime() === true`.
 *
 * Keep the WebView HTML bundle (`spark-web-context`) untouched — this
 * only gates the React-Native JS bundle.
 */

let sdkPromise = null;
let typesPromise = null;
let protoPromise = null;
let nativePromise = null;

function withReset(promise, slot) {
  const wrappedPromise = promise.catch(err => {
    // Allow retry after a transient load failure
    if (slot === 'sdk' && sdkPromise === wrappedPromise) sdkPromise = null;
    if (slot === 'types' && typesPromise === wrappedPromise) typesPromise = null;
    if (slot === 'proto' && protoPromise === wrappedPromise) protoPromise = null;
    if (slot === 'native' && nativePromise === wrappedPromise) nativePromise = null;
    throw err;
  });
  return wrappedPromise;
}

// Each loader uses a static literal so Metro can statically analyze the
// dependency (variable `require(moduleName)` is a bundling error). The
// `require` is inside the function so the heavy SDK is never evaluated on
// the WebView path — only when a native runtime caller actually invokes it.
// Jest's `jest.mock` still intercepts the synchronous `require`.

export function loadSparkSdk() {
  if (!sdkPromise) {
    sdkPromise = withReset(
      new Promise((resolve, reject) => {
        try {
          // eslint-disable-next-line global-require
          const mod = require('@buildonspark/spark-sdk');
          resolve(mod);
        } catch (e) {
          try {
            import('@buildonspark/spark-sdk').then(resolve, () => reject(e));
          } catch {
            reject(e);
          }
        }
      }),
      'sdk',
    );
  }
  return sdkPromise;
}

export function loadSparkTypes() {
  if (!typesPromise) {
    typesPromise = withReset(
      new Promise((resolve, reject) => {
        try {
          // eslint-disable-next-line global-require
          const mod = require('@buildonspark/spark-sdk/types');
          resolve(mod);
        } catch (e) {
          try {
            import('@buildonspark/spark-sdk/types').then(resolve, () => reject(e));
          } catch {
            reject(e);
          }
        }
      }),
      'types',
    );
  }
  return typesPromise;
}

export function loadSparkProto() {
  if (!protoPromise) {
    protoPromise = withReset(
      new Promise((resolve, reject) => {
        try {
          // eslint-disable-next-line global-require
          const mod = require('@buildonspark/spark-sdk/proto/spark');
          resolve(mod);
        } catch (e) {
          try {
            import('@buildonspark/spark-sdk/proto/spark').then(resolve, () => reject(e));
          } catch {
            reject(e);
          }
        }
      }),
      'proto',
    );
  }
  return protoPromise;
}

export function loadSparkNative() {
  if (!nativePromise) {
    nativePromise = withReset(
      new Promise((resolve, reject) => {
        try {
          // eslint-disable-next-line global-require
          const mod = require('@buildonspark/spark-sdk/native');
          resolve(mod);
        } catch (e) {
          try {
            import('@buildonspark/spark-sdk/native').then(resolve, () => reject(e));
          } catch {
            reject(e);
          }
        }
      }),
      'native',
    );
  }
  return nativePromise;
}

// Convenience helpers — each caches via the loader above
export async function getSparkWallet() {
  const m = await loadSparkSdk();
  return m.SparkWallet;
}

export async function getSparkAddressUtils() {
  const m = await loadSparkSdk();
  return {
    isValidSparkAddress: m.isValidSparkAddress,
    getNetworkFromSparkAddress: m.getNetworkFromSparkAddress,
    decodeSparkAddress: m.decodeSparkAddress,
    bech32mDecode: m.bech32mDecode,
    getLatestDepositTxId: m.getLatestDepositTxId,
  };
}

export async function getBuildUnilateralExitChain() {
  const m = await loadSparkSdk();
  return {
    buildUnilateralExitChain: m.buildUnilateralExitChain,
    Network: m.Network,
  };
}

export async function getTreeNode() {
  const m = await loadSparkProto();
  return m.TreeNode;
}

export async function getSparkReadonlyClient() {
  const m = await loadSparkSdk();
  return m.SparkReadonlyClient;
}

export async function getSparkNativeModules() {
  const m = await loadSparkNative();
  return m;
}

// Eager preload — call when fallback enters PENDING so the first
// native switch doesn't pay the 200-500 ms parse cost on demand.
// Fire-and-forget; errors are swallowed (demand path will retry).
export function preloadSparkSdk() {
  loadSparkSdk().catch(() => {});
  loadSparkTypes().catch(() => {});
}

// Test seam — reset cached promises between tests
export function __resetLazySparkForTest() {
  sdkPromise = null;
  typesPromise = null;
  protoPromise = null;
  nativePromise = null;
}

export function __setLazySparkForTest({ sdk, types, proto, native }) {
  if (sdk !== undefined) sdkPromise = sdk ? Promise.resolve(sdk) : null;
  if (types !== undefined) typesPromise = types ? Promise.resolve(types) : null;
  if (proto !== undefined) protoPromise = proto ? Promise.resolve(proto) : null;
  if (native !== undefined)
    nativePromise = native ? Promise.resolve(native) : null;
}

export function __getLazySparkStateForTest() {
  return { sdkPromise, typesPromise, protoPromise, nativePromise };
}

export function __setRawLazySparkForTest({ sdk, types, proto, native }) {
  if (sdk !== undefined) sdkPromise = sdk;
  if (types !== undefined) typesPromise = types;
  if (proto !== undefined) protoPromise = proto;
  if (native !== undefined) nativePromise = native;
}

export function __testWithResetForTest(promise, slot) {
  return withReset(promise, slot);
}
