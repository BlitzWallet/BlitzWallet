import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';

let flashnetInternalTransferIds = new Set();

export function getFlashnetTransfers() {
  return flashnetInternalTransferIds;
}

// Breez token payment ids are "{txHash}:{vout}"; ids are stored as the bare hash.
const baseId = id => (typeof id === 'string' ? id.split(':')[0] : id);

export function isFlashnetTransfer(txid) {
  return flashnetInternalTransferIds.has(baseId(txid));
}

export function setFlashnetTransfer(txid) {
  flashnetInternalTransferIds.add(baseId(txid));
  const current = Array.from(flashnetInternalTransferIds);
  setLocalStorageItem('savedFlashnetTransferIds', JSON.stringify(current));
}

export async function loadSavedTransferIds() {
  const savedIds = JSON.parse(
    await getLocalStorageItem('savedFlashnetTransferIds'),
  );
  flashnetInternalTransferIds = new Set(savedIds);
  return flashnetInternalTransferIds;
}
