import { bech32m } from 'bech32';
import { Point } from '@noble/secp256k1';

// Offline Spark address / invoice / token-identifier codec (protobuf + bech32m).
// Replaces the @buildonspark/spark-sdk address utilities; output shapes match them.

const LIMIT = 1024;
const HRP = {
  MAINNET: 'spark',
  TESTNET: 'sparkt',
  REGTEST: 'sparkrt',
  SIGNET: 'sparks',
  LOCAL: 'sparkl',
};
const LEGACY_HRP = {
  MAINNET: 'sp',
  TESTNET: 'spt',
  REGTEST: 'sprt',
  SIGNET: 'sps',
  LOCAL: 'spl',
};
const TOKEN_HRP = {
  MAINNET: 'btkn',
  TESTNET: 'btknt',
  REGTEST: 'btknrt',
  SIGNET: 'btkns',
  LOCAL: 'btknl',
};

const toHex = b => Buffer.from(b).toString('hex');
const invert = o =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
const PREFIX_TO_NETWORK = { ...invert(LEGACY_HRP), ...invert(HRP) };

function assertPublicKey(hex) {
  Point.fromHex(hex).assertValidity();
}

function decodeBech32m(address) {
  const i = address.lastIndexOf('1');
  if (i <= 0 || i >= address.length - 1)
    throw new Error('invalid bech32 string');
  return bech32m.decode(address, LIMIT);
}

export function getNetworkFromSparkAddress(address) {
  const network = PREFIX_TO_NETWORK[decodeBech32m(address).prefix];
  if (!network) throw new Error('Invalid Spark address prefix');
  return network;
}

// ---- minimal protobuf reader ----
function reader(bytes) {
  let i = 0;
  const varint = () => {
    let v = 0n;
    let shift = 0n;
    for (;;) {
      if (i >= bytes.length) throw new Error('Truncated varint');
      const b = bytes[i++];
      v |= BigInt(b & 0x7f) << shift;
      if (!(b & 0x80)) return v;
      shift += 7n;
    }
  };
  const lengthDelimited = () => {
    const len = Number(varint());
    if (i + len > bytes.length) throw new Error('Truncated field');
    const out = bytes.slice(i, i + len);
    i += len;
    return out;
  };
  // Calls fn(field, wireType) per field; fn consumes the value or returns false to skip.
  const fields = fn => {
    while (i < bytes.length) {
      const key = Number(varint());
      const field = key >> 3;
      const wire = key & 7;
      if (fn(field, wire) !== false) continue;
      if (wire === 0) varint();
      else if (wire === 2) lengthDelimited();
      else if (wire === 1) i += 8;
      else if (wire === 5) i += 4;
      else throw new Error(`Unsupported wire type ${wire}`);
    }
  };
  return { varint, lengthDelimited, fields };
}

function uuidString(bytes) {
  const h = toHex(bytes);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
    16,
    20,
  )}-${h.slice(20)}`;
}

function decodeInvoiceFields(bytes) {
  const r = reader(bytes);
  const out = { version: 0, id: '' };
  r.fields((field, wire) => {
    if (wire === 0 && field === 1) out.version = Number(r.varint());
    else if (wire === 2 && field === 2)
      out.id = uuidString(r.lengthDelimited());
    else if (wire === 2 && field === 3) {
      const t = { type: 'tokens' };
      const tr = reader(r.lengthDelimited());
      tr.fields((f, w) => {
        if (w !== 2) return false;
        const data = tr.lengthDelimited();
        if (f === 1) t.tokenIdentifier = toHex(data);
        else if (f === 2 && data.length) t.amount = BigInt(`0x${toHex(data)}`);
      });
      out.paymentType = t;
    } else if (wire === 2 && field === 4) {
      const s = { type: 'sats' };
      const sr = reader(r.lengthDelimited());
      sr.fields((f, w) => {
        if (f === 1 && w === 0) s.amount = Number(sr.varint());
        else return false;
      });
      out.paymentType = s;
    } else if (wire === 2 && field === 5) {
      out.memo = new TextDecoder().decode(r.lengthDelimited());
    } else if (wire === 2 && field === 6) {
      out.senderPublicKey = toHex(r.lengthDelimited());
    } else if (wire === 2 && field === 7) {
      const tr = reader(r.lengthDelimited());
      let seconds = 0;
      let nanos = 0;
      tr.fields((f, w) => {
        if (w !== 0) return false;
        if (f === 1) seconds = Number(tr.varint());
        else if (f === 2) nanos = Number(tr.varint());
        else return false;
      });
      out.expiryTime = new Date(seconds * 1000 + Math.floor(nanos / 1e6));
    } else return false;
  });
  return out;
}

export function decodeSparkAddress(address, network) {
  const net = getNetworkFromSparkAddress(address);
  if (network && network !== net)
    throw new Error('Invalid Spark address prefix');
  const { words } = decodeBech32m(address);
  const r = reader(Uint8Array.from(bech32m.fromWords(words)));
  let identityPublicKey;
  let sparkInvoiceFields;
  let signature;
  r.fields((field, wire) => {
    if (wire !== 2) return false;
    if (field === 1) identityPublicKey = toHex(r.lengthDelimited());
    else if (field === 2) {
      sparkInvoiceFields = decodeInvoiceFields(r.lengthDelimited());
    } else if (field === 3) {
      const s = r.lengthDelimited();
      signature = s.length ? toHex(s) : undefined;
    } else return false;
  });
  if (!identityPublicKey) throw new Error('Spark address missing identity key');
  assertPublicKey(identityPublicKey);
  return { identityPublicKey, network: net, sparkInvoiceFields, signature };
}

export function isValidSparkAddress(address) {
  try {
    decodeSparkAddress(address);
    return true;
  } catch {
    return false;
  }
}

// Plain (invoice-less) address for an identity public key.
export function encodeSparkAddress({ identityPublicKey, network = 'MAINNET' }) {
  assertPublicKey(identityPublicKey);
  const key = Buffer.from(identityPublicKey, 'hex');
  const payload = new Uint8Array(2 + key.length);
  payload[0] = 0x0a;
  payload[1] = key.length;
  payload.set(key, 2);
  return bech32m.encode(HRP[network], bech32m.toWords(payload), LIMIT);
}

export function encodeBech32mTokenIdentifier({ tokenIdentifier, network }) {
  if (!network) throw new Error('Network is required');
  return bech32m.encode(
    TOKEN_HRP[network],
    bech32m.toWords(tokenIdentifier),
    500,
  );
}
