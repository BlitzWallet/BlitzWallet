import { useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

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

export async function withShareTouchBlock(openShareSheet) {
  if (Platform.OS !== 'ios') return openShareSheet();
  setBlocking(true);
  try {
    return await openShareSheet();
  } finally {
    setBlocking(false);
  }
}

export default function ShareTouchBlocker() {
  const blocking = useSyncExternalStore(subscribe, () => isBlocking);
  if (!blocking) return null;
  return (
    <Pressable
      accessible={false}
      style={styles.blocker}
      onPressOut={() => setBlocking(false)}
    />
  );
}

const styles = StyleSheet.create({
  blocker: { ...StyleSheet.absoluteFillObject, zIndex: 1001 },
});
