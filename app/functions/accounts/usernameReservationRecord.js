import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';
import { claimUniqueName, ownsUniqueNameReservation } from '../../../db';
import { normalizePairingName } from './childPairing';

const NAME_TAKEN_THROTTLE_MS = 24 * 60 * 60 * 1000; // 24h

// Local record of the username reservation this device last confirmed:
//   { lower: canonical name, at: ms, takenAt?: ms }
// Deliberately NOT a sticky boolean — a boolean can't tell "backfill already
// claimed THIS name" from "the name changed since". The backfill (A6) compares
// record.lower to the current normalized display name to decide whether to
// reconcile. See initializeUserSettings.js and editProfileFieldPage.js.
export const USERNAME_RESERVATION_KEY = 'usernameReservationRecord';

export async function getUsernameReservationRecord() {
  const raw = await getLocalStorageItem(USERNAME_RESERVATION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function setUsernameReservationRecord(record) {
  await setLocalStorageItem(USERNAME_RESERVATION_KEY, JSON.stringify(record));
}

export async function clearUsernameReservationRecord() {
  await setLocalStorageItem(USERNAME_RESERVATION_KEY, JSON.stringify(null));
}

// Lazy backfill for existing users (A6): reserve the parent's current display
// name so they can name-pair, without ever renaming them. Best-effort — the
// caller runs it off the login critical path and it never throws.
//   - record.lower === myLower → owned last time, no-op (zero Firestore reads).
//   - name changed / unset → reconcile: if already owned, record it; else claim.
//   - only a CONFIRMED NAME_TAKEN is throttled (24h); a transient error retries.
export async function backfillUsernameReservation(uid, displayName) {
  try {
    const myLower = normalizePairingName(displayName);
    if (!uid || !myLower) return;

    const record = await getUsernameReservationRecord();
    if (record?.lower === myLower) return; // owned last time — common no-op

    if (
      record?.takenName === myLower &&
      typeof record?.takenAt === 'number' &&
      Date.now() - record.takenAt < NAME_TAKEN_THROTTLE_MS
    ) {
      return; // confirmed taken recently — don't hammer it
    }

    const owned = await ownsUniqueNameReservation(uid, myLower);
    if (owned) {
      await setUsernameReservationRecord({ lower: myLower, at: Date.now() });
      return;
    }

    const res = await claimUniqueName(uid, null, myLower);
    if (res.status === 'ok') {
      await setUsernameReservationRecord({ lower: myLower, at: Date.now() });
    } else if (res.status === 'NAME_TAKEN') {
      await setUsernameReservationRecord({
        ...(record || {}),
        takenName: myLower,
        takenAt: Date.now(),
      });
    }
    // transient error: leave the record untouched, retry next login (no throttle).
  } catch (err) {
    console.log('username backfill error', err);
  }
}
