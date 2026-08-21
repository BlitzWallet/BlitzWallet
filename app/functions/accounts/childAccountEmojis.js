import { useSyncExternalStore } from 'react';
import { CHILD_ACCOUNT_EMOJI_STORAGE_KEY } from '../../constants';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';

// Local-only store for managed (child) account profile emojis. Child accounts
// live in the Firebase-synced childAccounts registry, so their emoji must
// never travel to the DB — it is persisted in AsyncStorage under the child
// uuid and is intentionally lost if the device data is wiped.
//
// A module-level entries map backs a per-uuid subscription (same pattern as
// the profile-image cache) so rows only re-render when their own emoji
// changes.

const entries = new Map();
const listeners = new Set();
let loadPromise = null;

function emit() {
  listeners.forEach(listener => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function load() {
  try {
    const raw = await getLocalStorageItem(CHILD_ACCOUNT_EMOJI_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.entries(parsed).forEach(([uuid, emoji]) => {
      if (emoji) entries.set(uuid, emoji);
      else entries.delete(uuid);
    });
    emit();
  } catch (err) {
    console.log('Error loading child account emojis', err);
  }
}

function ensureLoaded() {
  if (!loadPromise) loadPromise = load();
  return loadPromise;
}

// Kick off the AsyncStorage read on first import so subscribers read a
// hydrated snapshot as soon as they mount.
ensureLoaded();

export function getChildAccountEmoji(uuid) {
  return entries.get(uuid) || '';
}

export async function setChildAccountEmoji(uuid, emoji) {
  if (!uuid) return;
  await ensureLoaded();
  if (emoji) entries.set(uuid, emoji);
  else entries.delete(uuid);
  emit();
  try {
    const raw = await getLocalStorageItem(CHILD_ACCOUNT_EMOJI_STORAGE_KEY);
    const current = raw ? JSON.parse(raw) : {};
    if (emoji) current[uuid] = emoji;
    else delete current[uuid];
    await setLocalStorageItem(
      CHILD_ACCOUNT_EMOJI_STORAGE_KEY,
      JSON.stringify(current),
    );
  } catch (err) {
    console.log('Error saving child account emoji', err);
  }
}

export function useChildAccountEmoji(uuid) {
  return useSyncExternalStore(subscribe, () =>
    uuid ? entries.get(uuid) || '' : '',
  );
}
