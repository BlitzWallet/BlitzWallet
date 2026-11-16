import i18next from 'i18next';

const MEMPOOL = 'https://mempool.space/api';
const BLOCKSTREAM = 'https://blockstream.info/api';
const TIMEOUT_MS = 10000;

export const isAlreadyKnown = message =>
  /already[ -](in[ -](block ?chain|utxo set|mempool)|known)/i.test(
    String(message || ''),
  );

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Reads: first host that answers OK wins.
async function read(path) {
  let lastError;
  for (const base of [MEMPOOL, BLOCKSTREAM]) {
    try {
      const res = await request(base + path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export const getTipHeight = () => read('/blocks/tip/height');

export async function getAddressUtxos(address) {
  const utxos = await read(`/address/${address}/utxo`);
  return utxos.map(u => ({
    txid: u.txid,
    vout: u.vout,
    valueSats: u.value,
    confirmed: !!u.status?.confirmed,
  }));
}

export async function broadcastTx(hex) {
  let lastMessage = i18next.t('settings.unilateralExit.errBroadcastFailed');
  for (const base of [MEMPOOL, BLOCKSTREAM]) {
    try {
      const res = await request(base + '/tx', { method: 'POST', body: hex });
      if (res.ok) return;
      lastMessage = await res.text();
      if (isAlreadyKnown(lastMessage)) return;
    } catch (err) {
      lastMessage = err.message;
    }
  }
  throw new Error(lastMessage);
}

export async function broadcastPackage(parentHex, childHex) {
  const res = await request(`${MEMPOOL}/v1/txs/package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([parentHex, childHex]),
  });
  if (!res.ok) {
    const text = await res.text();
    if (isAlreadyKnown(text)) return;
    throw new Error(text || `HTTP ${res.status}`);
  }
  const body = await res.json();
  if (body.package_msg === 'success') return;
  const errors = Object.values(body['tx-results'] || {})
    .map(r => r.error)
    .filter(e => e && !isAlreadyKnown(e));
  if (!errors.length && body['tx-results']) return;
  throw new Error(errors[0] || body.package_msg);
}
