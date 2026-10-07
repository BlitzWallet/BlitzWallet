import connectToLiquidNode from '../connectToLiquid';

let isConnected = false;
let connectionPromise = null;

export async function ensureLiquidConnection(accountMnemonic) {
  if (isConnected) return true;
  if (!connectionPromise) {
    connectionPromise = (async () => {
      const res = await connectToLiquidNode(accountMnemonic);
      isConnected = res?.isConnected === true;
      // Allow a retry on the next page visit if connect failed.
      if (!isConnected) connectionPromise = null;
      return isConnected;
    })();
  }
  return connectionPromise;
}

export function resetLiquidConnectionStatus() {
  isConnected = false;
  connectionPromise = null;
}

export function isLiquidNodeConnected() {
  return isConnected;
}
