import { useSyncExternalStore } from 'react';
import { AppState, Platform, Pressable, StyleSheet } from 'react-native';

// iOS lets a tap outside the share sheet both dismiss it and reach the screen
// behind it, and the sheet changes neither AppState nor navigation focus. So
// while a sheet is open a transparent layer sits over the navigator and takes
// that tap. It only ever takes one, so a share promise that never settles
// can't lock the app.
let isBlocking = false;
const listeners = new Set();

const setBlocking = next => {
  isBlocking = next;
  listeners.forEach(listener => listener());
};

const subscribe = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Resolves once the app leaves and comes back to the foreground, or after 1s
// if it never left (sheet failed to open).
const waitForAppReturn = () =>
  new Promise(resolve => {
    let left = false;
    const done = () => {
      clearTimeout(timer);
      sub.remove();
      resolve();
    };
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') left = true;
      else if (left) done();
    });
    const timer = setTimeout(() => {
      if (!left) done();
    }, 1000);
  });

// One share sheet at a time: a double tap would otherwise open two.
let isSharing = false;

export async function withShareTouchBlock(openShareSheet) {
  if (isSharing) return {};
  isSharing = true;
  try {
    if (Platform.OS === 'android') {
      // Android resolves as soon as the chooser launches, so hold the lock
      // until the app is back in the foreground.
      const returned = waitForAppReturn();
      const result = await openShareSheet();
      await returned;
      return result;
    }
    if (Platform.OS !== 'ios') return await openShareSheet();
    setBlocking(true);
    try {
      return await openShareSheet();
    } finally {
      setBlocking(false);
    }
  } finally {
    isSharing = false;
  }
}

export default function ShareTouchBlocker() {
  const blocking = useSyncExternalStore(subscribe, () => isBlocking);
  if (!blocking) return null;
  return (
    <Pressable
      accessible={false}
      style={styles.blocker}
      onPressOut={() => {
        // The tap outside closed the sheet; release the lock even if the
        // share promise never settles.
        isSharing = false;
        setBlocking(false);
      }}
    />
  );
}

const styles = StyleSheet.create({
  blocker: { ...StyleSheet.absoluteFillObject, zIndex: 1001 },
});
