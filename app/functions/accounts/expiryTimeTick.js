import { useSyncExternalStore } from 'react';

// One 10s interval for the whole app. Every relative-time label subscribes via
// useSyncExternalStore (a Set add, not a timer), so N rows share ONE timer.
// The interval starts lazily on first subscriber and clears on the last.
let tick = Math.floor(Date.now());
const listeners = new Set();
let interval = null;

function subscribe(cb) {
  listeners.add(cb);
  if (!interval) {
    interval = setInterval(() => {
      tick = Math.floor(Date.now());
      listeners.forEach(l => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      clearInterval(interval);
      interval = null;
    }
  };
}

// Returns the current time in ms, refreshed every 1s.
export const useAccountsExpiryTimeTick = () =>
  useSyncExternalStore(subscribe, () => tick);
