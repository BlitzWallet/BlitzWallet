import 'react-native-get-random-values';

import 'react-native-gesture-handler';

import '@azure/core-asynciterator-polyfill';
//neeed for encription + spark
import 'react-native-quick-base64';
import {Buffer} from '@craftzdog/react-native-buffer';
global.Buffer = Buffer;

// import 'text-encoding-polyfill';
import 'text-encoding'; // needed for spark

// Process polyfill
global.process = global.process || {};
global.process.env = global.process.env || {};
global.process.browser = true;
