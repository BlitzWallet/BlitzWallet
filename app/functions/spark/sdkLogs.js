import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getBuildNumber,
  getModel,
  getSystemVersion,
  getVersion,
} from 'react-native-device-info';
import sdkPackage from '../../../node_modules/@breeztech/breez-sdk-spark-react-native/package.json';

// Buffer of Breez SDK log lines (info and above), shown and shared from
// Settings > Logs. Both runtimes pass `sdkLogger` to initLogging. Lines are
// mirrored to AsyncStorage so they survive restarts and crashes.
// Writes are debounced (3s), but warn/error lines and backgrounding flush at
// once, so the lines right before a crash or OS kill are kept.
// ponytail: an info-only tail can still lose ~3s on a hard crash; use the
// native logDir if support needs those too.
const MAX_LINES = 3000;
const STORAGE_KEY = 'sdkLogs';
const FLUSH_MS = 3000;
let lines = [];
let flushTimer = null;

let lastFlush = 0;

const persist = () => {
  flushTimer = null;
  lastFlush = Date.now();
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lines)).catch(() => {});
};

const schedulePersist = () => {
  if (!flushTimer) flushTimer = setTimeout(persist, FLUSH_MS);
};

const flushNow = () => {
  clearTimeout(flushTimer);
  persist();
};

AppState.addEventListener('change', state => {
  if (state !== 'active' && flushTimer) flushNow();
});

// Load the previous sessions' lines; anything logged meanwhile stays after them.
Promise.resolve(AsyncStorage.getItem(STORAGE_KEY))
  .then(stored => {
    const previous = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(previous) || !previous.length) return;
    lines = [...previous, ...lines].slice(-MAX_LINES);
    schedulePersist();
  })
  .catch(() => {});

export const sdkLogger = {
  log(entry) {
    // A throw here crosses the FFI and aborts the process (panic=abort).
    try {
      const id = entry.instanceId ? ` [${entry.instanceId.slice(0, 8)}]` : '';
      lines.push(
        `${new Date().toISOString()} ${entry.level}${id} ${
          entry.line
        }`.trimEnd(),
      );
      if (lines.length > MAX_LINES) lines = lines.slice(-MAX_LINES);
      // Throttled to 1/s so a burst of warnings doesn't rewrite the whole buffer each line.
      if (/^(error|warn)/i.test(entry.level) && Date.now() - lastFlush > 1000) {
        flushNow();
      } else schedulePersist();
    } catch {}
  },
};

export const getSdkLogs = () => lines;

// Prepended to the shared file so support knows which build produced it.
export const getSdkLogsHeader = () =>
  [
    `Blitz ${getVersion()} (${getBuildNumber()})`,
    `${Platform.OS} ${getSystemVersion()}, ${getModel()}`,
    `breez-sdk-spark ${sdkPackage.version}, Mainnet`,
    `exported ${new Date().toISOString()}`,
    '---',
  ].join('\n');

export const clearSdkLogs = () => {
  lines = [];
  clearTimeout(flushTimer);
  flushTimer = null;
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
};
