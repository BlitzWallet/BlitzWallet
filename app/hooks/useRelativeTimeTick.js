import { useSyncExternalStore } from 'react';

// One 10s interval for the whole app. Every relative-time label subscribes via
// useSyncExternalStore (a Set add, not a timer), so N rows share ONE timer.
// The interval starts lazily on first subscriber and clears on the last.
let tick = Math.floor(Date.now() / 10000);
const listeners = new Set();
let interval = null;

function subscribe(cb) {
  listeners.add(cb);
  if (!interval) {
    interval = setInterval(() => {
      tick = Math.floor(Date.now() / 10000);
      listeners.forEach(l => l());
    }, 10000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      clearInterval(interval);
      interval = null;
    }
  };
}

// Returns the current 10s bucket. Multiply by 10000 for a ms timestamp.
export const useRelativeTimeTick = () =>
  useSyncExternalStore(subscribe, () => tick);
