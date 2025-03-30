// Must be the first import
import 'react-native-get-random-values';

import 'react-native-gesture-handler';

// Buffer polyfill
import {Buffer} from '@craftzdog/react-native-buffer';
global.Buffer = Buffer;

// Text encoder/decoder polyfill (if needed)
import 'text-encoding-polyfill';

// Process polyfill
global.process = global.process || {};
global.process.env = global.process.env || {};
global.process.browser = true;
