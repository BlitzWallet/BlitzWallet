import 'react-native-get-random-values';

import 'react-native-gesture-handler';

import '@azure/core-asynciterator-polyfill';
//neeed for encription + spark
import 'react-native-quick-base64';

import { Buffer } from '@craftzdog/react-native-buffer';
import QuickCrypto, {
  pbkdf2Sync,
  createHash,
  subtle,
} from 'react-native-quick-crypto';
global.Buffer = Buffer;

// Polyfill Web Crypto API for packages that rely on crypto.subtle (e.g. @branta-ops/branta)
// react-native-get-random-values (imported above) already provides crypto.getRandomValues
// need for @branta-ops/branta
global.crypto = QuickCrypto;
global.crypto.subtle = subtle;
global.crypto.randomUUID =
  global.crypto.randomUUID ||
  function () {
    const bytes = new Uint8Array(16);
    global.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
      .slice(6, 8)
      .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
  };

// import 'text-encoding-polyfill';
import 'text-encoding'; // needed for spark

//Fixing js blocking from ethers package
import { ethers } from 'ethers';

// --- Register native SHA512 implementation ---
ethers.sha512.register(data => {
  return Uint8Array.from(createHash('sha512').update(data).digest());
});

// --- Register native PBKDF2 implementation ---
ethers.pbkdf2.register((password, salt, iterations, keyLen, algo) => {
  const derivedKey = pbkdf2Sync(
    Buffer.from(password),
    Buffer.from(salt),
    iterations,
    keyLen,
    algo.toLowerCase(),
  );
  return Uint8Array.from(derivedKey);
});

// Process polyfill
global.process = global.process || {};
global.process.env = global.process.env || {};
global.process.browser = true;
