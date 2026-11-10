import AsyncStorage from '@react-native-async-storage/async-storage';

// Buffer of Breez SDK log lines (info and above), shown and shared from
// Settings > Logs. Both runtimes pass `sdkLogger` to initLogging. Lines are
// mirrored to AsyncStorage so they survive restarts and crashes.
// ponytail: debounced write, so a hard crash can lose the last ~3s; write per
// line (or the native logDir) if support needs the final lines before a crash.
const MAX_LINES = 2000;
const STORAGE_KEY = 'sdkLogs';
const FLUSH_MS = 3000;
let lines = [];
let flushTimer = null;

const persist = () => {
  flushTimer = null;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lines)).catch(() => {});
};

const schedulePersist = () => {
  if (!flushTimer) flushTimer = setTimeout(persist, FLUSH_MS);
};

// Load the previous sessions' lines; anything logged meanwhile stays after them.
AsyncStorage.getItem(STORAGE_KEY)
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
      lines.push(
        `${new Date().toISOString()} ${entry.level} ${entry.line}`.trimEnd(),
      );
      if (lines.length > MAX_LINES) lines = lines.slice(-MAX_LINES);
      schedulePersist();
    } catch {}
  },
};

export const getSdkLogs = () => lines;

export const clearSdkLogs = () => {
  lines = [];
  clearTimeout(flushTimer);
  flushTimer = null;
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
};
