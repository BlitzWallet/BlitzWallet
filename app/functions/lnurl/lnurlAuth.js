import { HDKey } from '@scure/bip32';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { bytesToHex } from '@noble/hashes/utils';
import { mnemonicToSeedAsync } from '../nostrCompatability';
import { isHTTPS } from './ishttps';

// LUD-04: derive the service-specific linking key pair for a given domain.
export async function deriveLinkingKey(mnemonic, domain) {
  const seed = await mnemonicToSeedAsync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);

  // Private hashingKey derived at m/138'/0
  const hashingKey = root.derive("m/138'/0");
  const mac = hmac(
    sha256,
    hashingKey.privateKey,
    new TextEncoder().encode(domain),
  );

  // First 16 bytes -> four big-endian uint32 -> m/138'/<i0>/<i1>/<i2>/<i3>.
  // Indices with the high bit set are hardened automatically by deriveChild.
  const dv = new DataView(mac.buffer, mac.byteOffset, 16);
  let node = root.derive("m/138'");
  for (let i = 0; i < 4; i++) {
    node = node.deriveChild(dv.getUint32(i * 4, false));
  }

  return node;
}

// LUD-04: sign the k1 challenge with the domain linking key and call the service.
// Resolves with the service response ({ status: 'OK' }) or throws with the reason.
export async function lnurlAuth({ k1, callback, mnemonic }) {
  const callbackUrl = new URL(callback);
  // FQDN of the LN SERVICE (trailing dot omitted), used as the HMAC message.
  const domain = callbackUrl.hostname;

  // LUD-01/LUD-17: clearnet must use HTTPS; allow HTTP only for .onion services.
  if (!isHTTPS(callback) && !domain.endsWith('.onion')) {
    throw new Error('LNURL must use HTTPS');
  }

  if (!/^[0-9a-fA-F]{64}$/.test(k1 || '')) {
    throw new Error('Invalid k1 challenge');
  }

  const linkingKey = await deriveLinkingKey(mnemonic, domain);

  // k1 is a 32-byte hex challenge that is signed as-is (no prehash).
  const k1Bytes = Uint8Array.from(Buffer.from(k1, 'hex'));
  const signature = secp256k1.sign(k1Bytes, linkingKey.privateKey, {
    prehash: false,
  });

  callbackUrl.searchParams.set('sig', bytesToHex(signature.toBytes('der')));
  callbackUrl.searchParams.set(
    'key',
    bytesToHex(secp256k1.getPublicKey(linkingKey.privateKey, true)),
  );

  // LUD-01: ignore HTTP status/headers, parse the JSON body.
  const response = await fetch(callbackUrl.toString());
  const data = await response.json();
  if (data.status === 'ERROR') {
    // Genuine rejection by the service (vs. a transient network failure above).
    const error = new Error(data.reason || 'LNURL auth failed');
    error.isServiceRejection = true;
    throw error;
  }
  return data;
}
