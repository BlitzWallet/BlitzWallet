// Web polyfills. Browsers already provide crypto.getRandomValues/subtle and a
// URL implementation, so we only need Buffer, gesture-handler, and ethers'
// native-hash registrations. Crucially we do NOT overwrite global.crypto with
// a shim — the native WebCrypto stays.
import 'react-native-gesture-handler';

import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;

import '@azure/core-asynciterator-polyfill';
import 'text-encoding';

// randomUUID exists in modern browsers; guard just in case.
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = function () {
    const bytes = new Uint8Array(16);
    global.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
      .slice(6, 8)
      .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
  };
}

// ethers: register @noble-backed sha512/pbkdf2 (matches the native pollyfill,
// keeps ethers off its slow pure-JS fallback).
import { ethers } from 'ethers';
import { sha512 } from '@noble/hashes/sha2';
import { pbkdf2 as noblePbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';

ethers.sha512.register(data => Uint8Array.from(sha512(data)));
ethers.pbkdf2.register((password, salt, iterations, keyLen, algo) => {
  const hash = algo.toLowerCase() === 'sha512' ? sha512 : sha256;
  return Uint8Array.from(
    noblePbkdf2(hash, password, salt, { c: iterations, dkLen: keyLen }),
  );
});

global.process = global.process || {};
global.process.env = global.process.env || {};
global.process.browser = true;
