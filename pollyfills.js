import 'react-native-get-random-values';

import 'react-native-gesture-handler';

import '@azure/core-asynciterator-polyfill';
//neeed for encription + spark
import 'react-native-quick-base64';
import { Buffer } from '@craftzdog/react-native-buffer';
import { pbkdf2Sync, createHash } from 'react-native-quick-crypto';
global.Buffer = Buffer;

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
