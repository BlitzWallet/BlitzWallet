import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';

let flashnetInternalTransferIds = new Set();

export function getFlashnetTransfers() {
  return flashnetInternalTransferIds;
}

export function isFlashnetTransfer(txid) {
  return flashnetInternalTransferIds.has(txid);
}

export function setFlashnetTransfer(txid) {
  flashnetInternalTransferIds.add(txid);
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
