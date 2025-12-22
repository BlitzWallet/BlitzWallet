import connectToLiquidNode from '../connectToLiquid';

let isConnected = false;
let connectionPromise = null;

export async function ensureLiquidConnection(accountMnemonic) {
  if (isConnected) return true;

  if (!connectionPromise) {
    connectionPromise = (async () => {
      const res = await connectToLiquidNode(accountMnemonic);
      isConnected = res?.isConnected === true;
      return isConnected;
    })();
  }

  return connectionPromise;
}

export function isLiquidNodeConnected() {
  return isConnected;
}
