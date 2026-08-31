import { db } from './initializeFirebase';
import {
  getCachedMessages,
  queueSetCashedMessages,
} from '../app/functions/messaging/cachedMessages';
import {
  collection,
  query,
  where,
  getDocs,
  getFirestore,
  getDoc,
  doc,
  setDoc,
  limit,
  addDoc,
  writeBatch,
  or,
  orderBy,
  deleteDoc,
  increment,
  updateDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  deleteField,
} from '@react-native-firebase/firestore';
import { getLocalStorageItem, setLocalStorageItem } from '../app/functions';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../app/functions/crashlyticsLogs';
import {
  decryptMessage,
  encriptMessage,
} from '../app/functions/messaging/encodingAndDecodingMessages';
import { getNextChildDerivationIndex } from '../app/functions/accounts/childAccounts';
import {
  makePairingCode,
  normalizePairingName,
} from '../app/functions/accounts/childPairing';
import { blitzProxyFetch } from '../app/functions/blitzProxyFetch';
export const LOCAL_STORED_USER_DATA_KEY = 'LOCAL_USER_OBJECT';

export async function addDataToCollection(dataObject, collectionName, uuid) {
  try {
    if (!uuid) throw Error('Not authenticated');
    crashlyticsLogReport(
      `Starting add data to collection for ${collectionName}`,
    );

    const db = getFirestore();
    const docRef = doc(db, collectionName, uuid);

    await setDoc(docRef, dataObject, { merge: true });

    console.log('Document merged with ID: ', uuid);
    return true;
  } catch (e) {
    console.error('Error adding document: ', e);
    crashlyticsRecordErrorReport(e.message);
    return false;
  }
}

/**
 * Atomically reserve the next child derivation index for a parent. The
 * counter lives on the parent's blitzWalletUsers doc, so allocation happens
 * inside a Firestore transaction: concurrent creates (two parent devices, or a
 * retry after a failed settings write) read the same doc and Firestore retries
 * one side, guaranteeing no two children ever derive the same index/mnemonic.
 * The index is burned even if the create flow later fails — that is the point:
 * a failed flow must never hand the same index to a second attempt.
 * @param {string} parentUid - Parent's blitzWalletUsers doc id (contacts pubkey)
 * @returns {Promise<number|null>} Reserved child index, or null on failure
 */
export async function reserveNextChildIndex(parentUid) {
  try {
    if (!parentUid) throw Error('Not authenticated');
    const parentRef = doc(db, 'blitzWalletUsers', parentUid);

    let childIndex = null;
    await runTransaction(db, async tx => {
      const parentSnap = await tx.get(parentRef);
      childIndex = getNextChildDerivationIndex(
        parentSnap.exists() ? parentSnap.data() : {},
      );
      tx.set(
        parentRef,
        { nextChildDerivationIndex: childIndex + 1 },
        { merge: true },
      );
    });

    return childIndex;
  } catch (e) {
    console.error('Error reserving child index:', e);
    crashlyticsRecordErrorReport(e.message);
    return null;
  }
}

/**
 * Atomically update the parent's childAccounts registry inside a Firestore
 * transaction. Edits must never be computed from a stale local snapshot: a
 * setDoc merge replaces the whole array, so a second device holding an old
 * childAccounts would wipe every registry entry created since its snapshot
 * (the create path avoids this with arrayUnion; edits get the same guarantee
 * here by reading the live array inside the transaction). Mirrors
 * reserveNextChildIndex. The update rule allows it: childAccounts is not a
 * locked field and identityUuidBound is untouched.
 * @param {string} parentUid - Parent's blitzWalletUsers doc id (contacts pubkey)
 * @param {(entries: Array<object>) => Array<object>} updateFn - Maps the live
 *   registry array to its new value (e.g. rename / spending-limit edit).
 * @returns {Promise<boolean>} True on success, false on failure
 */
export async function updateChildAccountRegistryEntry(parentUid, updateFn) {
  try {
    if (!parentUid) throw Error('Not authenticated');
    const parentRef = doc(db, 'blitzWalletUsers', parentUid);

    await runTransaction(db, async tx => {
      const parentSnap = await tx.get(parentRef);
      const live =
        parentSnap.exists() && Array.isArray(parentSnap.data().childAccounts)
          ? parentSnap.data().childAccounts
          : [];
      tx.set(parentRef, { childAccounts: updateFn(live) }, { merge: true });
    });

    return true;
  } catch (e) {
    console.error('Error updating child account registry entry:', e);
    crashlyticsRecordErrorReport(e.message);
    return false;
  }
}

// ── Username reservation layer (usernames/{nameLower}) ─────────────────────
// The doc id *is* the canonical name, so `create` atomically enforces global
// uniqueness. Additive-only: nothing tightens blitzWalletUsers yet, so no
// installed client's writes start failing. All three helpers key on the
// canonical normalizePairingName(...) id so they land at the exact path child
// pairing later reads/reserves. Best-effort: a failure never blocks a profile
// write or login.

/**
 * Atomically claim usernames/{newLower} for `uid`. On a successful rename also
 * releases the caller's old reservation (only if the caller owns it). If the
 * name is taken by someone else, the old reservation is left untouched (never
 * orphan the caller's current name on a failed claim).
 * @returns {Promise<{status: 'ok' | 'NAME_TAKEN' | 'error'}>}
 */
export async function claimUniqueName(uid, oldLower, newLower) {
  try {
    if (!uid) return { status: 'error' };
    const newId = normalizePairingName(newLower);
    if (!newId) return { status: 'error' };
    const oldId = oldLower ? normalizePairingName(oldLower) : '';
    const newRef = doc(db, 'usernames', newId);
    const oldRef =
      oldId && oldId !== newId ? doc(db, 'usernames', oldId) : null;

    let status = 'ok';
    await runTransaction(db, async tx => {
      // Firestore requires all reads before any write.
      const newSnap = await tx.get(newRef);
      const oldSnap = oldRef ? await tx.get(oldRef) : null;

      if (newSnap.exists() && newSnap.data().uid !== uid) {
        status = 'NAME_TAKEN'; // do NOT touch oldRef — never orphan current name
        return;
      }
      // Create-only: a set on an existing doc is an `update`, which the rules
      // deny (usernames/ has `allow update: if false`). When the caller already
      // owns the reservation (self-reclaim / rename-back), skip the write — the
      // reservation is already ours, so returning ok is correct.
      if (!newSnap.exists()) tx.set(newRef, { uid });
      if (oldSnap && oldSnap.exists() && oldSnap.data().uid === uid) {
        tx.delete(oldRef);
      }
    });
    return { status };
  } catch (e) {
    console.error('Error claiming unique name:', e);
    crashlyticsRecordErrorReport(e.message);
    return { status: 'error' };
  }
}

/** True iff usernames/{lower} exists and is reserved by `uid`. */
export async function ownsUniqueNameReservation(uid, lower) {
  try {
    const id = normalizePairingName(lower);
    if (!uid || !id) return false;
    const snap = await getDoc(doc(db, 'usernames', id));
    return snap.exists() && snap.data().uid === uid;
  } catch (e) {
    console.error('Error checking name reservation:', e);
    return false;
  }
}

/**
 * Available iff no blitzWalletUsers profile displays the name AND the reservation
 * is free or already owned by `uid` (self-reclaim of an orphaned own name).
 */
export async function isUniqueNameAvailable(uid, lower) {
  try {
    const id = normalizePairingName(lower);
    if (!id) return false;
    const nameFree = await isValidUniqueName('blitzWalletUsers', id);
    if (!nameFree) return false;
    const snap = await getDoc(doc(db, 'usernames', id));
    return !snap.exists() || snap.data().uid === uid;
  } catch (e) {
    console.error('Error checking name availability:', e);
    return false;
  }
}

const saveToLocalDB = async dataObject => {
  try {
    const existingData = await getLocalStorageItem(LOCAL_STORED_USER_DATA_KEY);
    let userData = existingData ? JSON.parse(existingData) : {};

    // Merge new data with existing local user data
    userData = { ...userData, ...dataObject };

    // Save back to AsyncStorage
    await setLocalStorageItem(
      LOCAL_STORED_USER_DATA_KEY,
      JSON.stringify(userData),
    );
    return true;
  } catch (error) {
    console.error('Error writing document:', error);
    throw error;
  }
};

export async function getDataFromCollection(collectionName, uuid) {
  try {
    crashlyticsLogReport('Starting to get data to collection');
    if (!uuid) throw Error('Not authenticated');
    try {
      const docRef = doc(db, collectionName, uuid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (collectionName === 'blitzWalletUsers') {
          // Identity fallback: a sender can strip the uuid fields from their
          // own doc (firestore.rules only binds them while present), and
          // consumers trust the stored uuid over the doc id — a stripped
          // field would land recipients with an unpayable uuid:undefined
          // contact entry. The doc id IS the identity, so fall back to it
          // whenever the stored field is missing.
          const fallbackUuid = userData?.uuid ?? docSnap.id;
          const myProfile = userData?.contacts?.myProfile;
          return {
            ...userData,
            uuid: fallbackUuid,
            contacts: userData?.contacts
              ? {
                  ...userData.contacts,
                  myProfile:
                    myProfile && typeof myProfile === 'object'
                      ? { ...myProfile, uuid: myProfile.uuid ?? fallbackUuid }
                      : myProfile,
                }
              : userData?.contacts,
          };
        }
        return userData;
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      crashlyticsRecordErrorReport(err.message);
      return null;
    }

    // // const existingData = await getLocalStorageItem(LOCAL_STORED_USER_DATA_KEY);
    // // if (existingData) {
    // //   console.log('returning existing data...');
    // //   return JSON.parse(existingData);
    // // }

    // const docRef = db.collection(collectionName).doc(uuid);
    // const docSnap = await docRef.get();
    // if (docSnap.exists) {
    //   const userData = docSnap.data();
    //   // await setLocalStorageItem(
    //   //   LOCAL_STORED_USER_DATA_KEY,
    //   //   JSON.stringify(userData),
    //   // );
    //   return userData;
    // }
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function getDocsByIds(collectionName, docIds) {
  if (!docIds || docIds.length === 0) return [];

  const db = getFirestore();

  const docRefs = docIds.map(id => doc(db, collectionName, id));

  const snapshots = await Promise.all(docRefs.map(ref => getDoc(ref)));

  return snapshots.map(snap => {
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  });
}

/**
 * Removes one id from the user's accountsLnurl registry map. setDoc merge can
 * add/overwrite map keys but never delete one, so pruning (deleted imported
 * accounts) must use a FieldValue.delete() update.
 * @param {string} publicKey - User's blitzWalletUsers doc id
 * @param {string} id - Registry map key to remove
 * @returns {Promise<boolean>}
 */
export async function deleteLnurlRegistryEntry(publicKey, id) {
  try {
    if (!publicKey || !id) throw Error('Missing user or registry entry id');
    // ids are hex prefixes; reject anything else so it can't inject into the
    // dotted Firestore field path.
    if (!/^[0-9a-f]+$/.test(id)) throw Error('Invalid registry entry id');
    const docRef = doc(db, 'blitzWalletUsers', publicKey);
    await updateDoc(docRef, { [`accountsLnurl.${id}`]: deleteField() });
    console.log('Deleted LNURL registry entry:', id);
    return true;
  } catch (e) {
    console.error('Error deleting LNURL registry entry:', e);
    crashlyticsRecordErrorReport(e.message);
    return false;
  }
}

export async function batchDeleteLnurlPayments(uuid, paymentIds) {
  try {
    if (!uuid) throw Error('User ID missing');
    if (!paymentIds?.length) throw Error('No payment IDs provided');

    const batch = writeBatch(db);

    paymentIds.forEach(paymentId => {
      const paymentRef = doc(
        db,
        'blitzWalletUsers',
        uuid,
        'lnurlPayments',
        paymentId,
      );
      batch.delete(paymentRef);
    });

    await batch.commit();

    return { success: true, count: paymentIds.length };
  } catch (err) {
    console.error('Error batch deleting payments:', err);
    return { success: false, message: err.message };
  }
}

// Might be able to change from get docs to get doc
export async function isValidUniqueName(
  collectionName = 'blitzWalletUsers',
  wantedName,
) {
  try {
    crashlyticsLogReport('Seeing if the unique name exists');
    const usersRef = collection(db, collectionName);
    const q = query(
      usersRef,
      where(
        'contacts.myProfile.uniqueNameLower',
        '==',
        wantedName.toLowerCase(),
      ),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  } catch (error) {
    console.error('Error checking unique name:', error);
    crashlyticsRecordErrorReport(error.message);
    return false;
  }
}

export async function getSingleContact(
  wantedName,
  collectionName = 'blitzWalletUsers',
) {
  try {
    crashlyticsLogReport('Getting single contact');
    const usersRef = collection(db, collectionName);
    const q = query(
      usersRef,
      where(
        'contacts.myProfile.uniqueNameLower',
        '==',
        wantedName.toLowerCase(),
      ),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('Error fetching contact:', error);
    crashlyticsLogReport(error.message);
    return [];
  }
}

// Might be able to change from get docs to get doc
export async function canUsePOSName(
  collectionName = 'blitzWalletUsers',
  wantedName,
) {
  try {
    crashlyticsLogReport('Seeing if you can use point-of-sale name');
    const usersRef = collection(db, collectionName);
    const q = query(
      usersRef,
      where('posSettings.storeNameLower', '==', wantedName.toLowerCase()),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  } catch (error) {
    console.error('Error checking POS name:', error);
    crashlyticsLogReport(error.message);
    return false;
  }
}

export async function searchUsers(
  searchTerm,
  collectionName = 'blitzWalletUsers',
) {
  const parsedSearchTerm = searchTerm.trim();
  if (!parsedSearchTerm) return [];

  try {
    crashlyticsLogReport('Searching database for users');
    const usersRef = collection(db, collectionName);
    const term = parsedSearchTerm.toLowerCase();

    // Execute two separate queries and merge results
    const uniqueNameQuery = query(
      usersRef,
      where('contacts.myProfile.uniqueNameLower', '>=', term),
      where('contacts.myProfile.uniqueNameLower', '<=', term + '\uffff'),
      limit(5),
    );

    const nameQuery = query(
      usersRef,
      where('contacts.myProfile.nameLower', '>=', term),
      where('contacts.myProfile.nameLower', '<=', term + '\uffff'),
      limit(5),
    );

    // Execute both queries
    const [uniqueNameSnapshot, nameSnapshot] = await Promise.all([
      getDocs(uniqueNameQuery),
      getDocs(nameQuery),
    ]);

    // Combine results, removing duplicates using Map
    const uniqueUsers = new Map();

    // Process uniqueName results
    uniqueNameSnapshot.docs.forEach(doc => {
      const profile = doc.data().contacts?.myProfile;
      if (profile?.uuid) {
        uniqueUsers.set(profile.uuid, profile);
      }
    });

    // Process name results
    nameSnapshot.docs.forEach(doc => {
      const profile = doc.data().contacts?.myProfile;
      if (profile?.uuid) {
        uniqueUsers.set(profile.uuid, profile);
      }
    });

    return Array.from(uniqueUsers.values());
  } catch (error) {
    console.error('Error searching users:', error);
    crashlyticsRecordErrorReport(error.message);
    return [];
  }
}

export async function updateMessage({
  newMessage,
  fromPubKey,
  toPubKey,
  onlySaveToLocal,
  retrivedContact,
  privateKey,
  currentTime,
}) {
  try {
    crashlyticsLogReport('Starting updating contact message');
    const messagesRef = collection(db, 'contactMessages');
    const timestamp = new Date().getTime();
    const useEncription = retrivedContact.isUsingEncriptedMessaging;

    let message = {
      fromPubKey,
      toPubKey,
      message: newMessage,
      timestamp,
      serverTimestamp: currentTime,
      isGiftCard: !!newMessage?.giftCardInfo,
    };

    if (onlySaveToLocal) {
      queueSetCashedMessages({
        newMessagesList: [message],
        myPubKey: fromPubKey,
      });
      return true;
    }

    if (useEncription) {
      let messgae =
        typeof message.message === 'string'
          ? message.message
          : JSON.stringify(message.message);
      const encripted = encriptMessage(privateKey, toPubKey, messgae);
      message.message = encripted;
    }

    await addDoc(messagesRef, message);
    console.log('New message was published:', message);
    return true;
  } catch (err) {
    console.error('Error updating message:', err);
    return false;
  }
}

export async function bulkUpdateMessages(messages) {
  try {
    crashlyticsLogReport('Starting bulk update contact messages');
    const batch = writeBatch(db);
    const messagesRef = collection(db, 'contactMessages');
    const timestamp = new Date().getTime();

    for (const {
      fromPubKey,
      toPubKey,
      newMessage,
      retrivedContact,
      privateKey,
      currentTime,
    } of messages) {
      const useEncription = retrivedContact.isUsingEncriptedMessaging;
      let message = {
        fromPubKey,
        toPubKey,
        message: newMessage,
        timestamp,
        serverTimestamp: currentTime,
        isGiftCard: !!newMessage?.giftCardInfo,
      };

      if (useEncription) {
        const msgStr =
          typeof message.message === 'string'
            ? message.message
            : JSON.stringify(message.message);
        message.message = encriptMessage(privateKey, toPubKey, msgStr);
      }

      batch.set(doc(messagesRef), message);
    }

    await batch.commit();
    console.log('Bulk messages committed:', messages.length);
    return true;
  } catch (err) {
    console.error('Error bulk updating messages:', err);

    return false;
  }
}

export async function syncDatabasePayment(myPubKey, privateKey) {
  try {
    crashlyticsLogReport('Starting sync database payments');
    const cachedConversations = await getCachedMessages();
    const savedMillis = cachedConversations.lastMessageTimestamp;
    console.log('Retrieving docs from timestamp:', savedMillis);

    const messagesRef = collection(db, 'contactMessages');
    const combinedQuery = query(
      messagesRef,
      where('timestamp', '>', savedMillis),
      or(
        where('toPubKey', '==', myPubKey),
        where('fromPubKey', '==', myPubKey),
      ),
      orderBy('timestamp'),
    );

    const snapshot = await getDocs(combinedQuery);
    const allMessages = snapshot.docs.map(doc => doc.data());

    if (allMessages.length === 0) return [];

    console.log(`${allMessages.length} messages received from history`);

    const processedMessages = await processWithRAF(
      allMessages,
      myPubKey,
      privateKey,
    );

    return processedMessages;
  } catch (err) {
    console.error('Error syncing database payments:', err);
    return [];
  }
}

function processWithRAF(allMessages, myPubKey, privateKey) {
  return new Promise(resolve => {
    const processedMessages = [];
    let currentIndex = 0;
    const MESSAGES_PER_FRAME = 50;

    function processChunk() {
      console.log('processsing contact messages', currentIndex);
      const endIndex = Math.min(
        currentIndex + MESSAGES_PER_FRAME,
        allMessages.length,
      );

      for (let i = currentIndex; i < endIndex; i++) {
        const message = allMessages[i];
        try {
          const isReceived = message.toPubKey === myPubKey;
          if (typeof message.message === 'string') {
            const sendersPubkey =
              message.toPubKey === myPubKey
                ? message.fromPubKey
                : message.toPubKey;
            const decoded = decryptMessage(
              privateKey,
              sendersPubkey,
              message.message,
            );
            if (!decoded) continue;

            let parsedMessage;
            try {
              parsedMessage = JSON.parse(decoded);
            } catch (err) {
              console.log('error parsing decoded message', err);
              continue;
            }
            processedMessages.push({
              ...message,
              message: parsedMessage,
              sendersPubkey,
              isReceived,
            });
          } else {
            processedMessages.push(message);
          }
        } catch (err) {
          console.log('error decoding incoming request from history');
        }
      }

      currentIndex = endIndex;

      if (currentIndex < allMessages.length) {
        requestAnimationFrame(processChunk);
      } else {
        resolve(processedMessages);
      }
    }

    requestAnimationFrame(processChunk);
  });
}

export async function isValidNip5Name(wantedName) {
  try {
    crashlyticsLogReport('Seeing if the unique name exists');
    const usersRef = collection(db, 'nip5Verification');
    const q = query(
      usersRef,
      where('nameLower', '==', wantedName.toLowerCase()),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  } catch (error) {
    console.error('Error checking unique name:', error);
    crashlyticsRecordErrorReport(error.message);
    return false;
  }
}
export async function addNip5toCollection(dataObject, uuid) {
  try {
    if (!uuid) throw Error('Not authenticated');
    crashlyticsLogReport('Starting to add data to nip5');

    const db = getFirestore();
    const docRef = doc(db, 'nip5Verification', uuid);

    await setDoc(docRef, dataObject, { merge: true });

    return true;
  } catch (e) {
    console.error('Error adding document: ', e);
    crashlyticsRecordErrorReport(e.message);
    return false;
  }
}
export async function deleteNip5FromCollection(uuid) {
  try {
    if (!uuid) throw Error('Not authenticated');
    crashlyticsLogReport('Starting to remove data from nip5');

    const db = getFirestore();
    const docRef = doc(db, 'nip5Verification', uuid);

    await deleteDoc(docRef);

    console.log('Document deleted');
    return true;
  } catch (e) {
    console.error('Error deleting document', e);
    crashlyticsRecordErrorReport(e.message);
    return false;
  }
}

export async function addGiftToDatabase(dataObject) {
  try {
    const db = getFirestore();
    const docRef = doc(db, 'blitzGifts', dataObject.uuid);

    await setDoc(docRef, dataObject, { merge: false });

    console.log('Document merged with ID: ', dataObject.uuid);
    return true;
  } catch (e) {
    console.error('Error adding gift to database: ', e);

    return false;
  }
}

export async function bulkDeleteGiftsFromDatabase(uuids) {
  try {
    const db = getFirestore();
    const batch = writeBatch(db);
    uuids.forEach(uuid => {
      const giftRef = doc(db, 'blitzGifts', uuid);
      batch.delete(giftRef);
    });
    await batch.commit();
    console.log(`Bulk deleted ${uuids.length} gifts from database`);
    return true;
  } catch (e) {
    console.error('Error bulk deleting gifts from database:', e);
    crashlyticsRecordErrorReport(e.message);
    return false;
  }
}

export async function bulkAddGiftsToDatabase(gifts) {
  try {
    const db = getFirestore();
    const batch = writeBatch(db);
    gifts.forEach(gift => {
      const giftRef = doc(db, 'blitzGifts', gift.uuid);
      const { claimURL, ...giftWithoutClaimUrl } = gift;
      batch.set(giftRef, giftWithoutClaimUrl, { merge: false });
    });
    await batch.commit();
    console.log(`Bulk saved ${gifts.length} gifts to database`);
    return true;
  } catch (e) {
    console.error('Error bulk adding gifts to database:', e);
    return false;
  }
}

export async function updateGiftInDatabase(dataObject) {
  try {
    const db = getFirestore();
    const docRef = doc(db, 'blitzGifts', dataObject.uuid);

    const { claimURL: _claimURL, ...dataToSave } = dataObject;
    await setDoc(docRef, dataToSave, { merge: true });

    console.log('Document merged with ID: ', dataObject.uuid);
    return true;
  } catch (e) {
    console.error('Error adding gift to database: ', e);

    return false;
  }
}

export async function getGiftCard(cardUUID) {
  try {
    const db = getFirestore();
    const docRef = doc(db, 'blitzGifts', cardUUID);

    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const userData = docSnap.data();
      return userData;
    }
  } catch (e) {
    console.error('Error adding gift to database: ', e);
    crashlyticsRecordErrorReport(e.message);
    return false;
  }
}

export async function deleteGift(uuid) {
  try {
    const db = getFirestore();
    const docRef = doc(db, 'blitzGifts', uuid);

    await deleteDoc(docRef);

    console.log('Gift deleted:', uuid);
    return true;
  } catch (e) {
    console.error('Error deleting gift:', e);
    crashlyticsRecordErrorReport(e.message);
    return false;
  }
}

// ── Family pairing handshake ───────────────────────────────────────────────
// Two-level layout keyed on the parent's canonical username (the rid):
//   familyPairing/{rid}/sessions/{code}        — the session state machine
//     The session doc id IS the parent's 6-digit pairing code (makePairingCode),
//     generated fresh per session. There is NO familyPairing/{rid} pointer doc:
//     the secret code is the rendezvous, so an attacker who knows the username
//     but not the live code cannot find the session to snipe it.
//     authoritative status (WAITING → JOINED → VERIFYING → COMPLETED, or
//     CANCELLED) + serverTimestamp() lifecycle fields. A fresh code = a fresh
//     namespace, so sessions never overlap; time is judged only by the rules
//     against request.time.
//   familyPairing/{rid}/sessions/{code}/handshake/{party}
//     per-session write-once handshake docs, gated on the session doc's status.
// expireAt (a plain client Timestamp) is GC-only: it feeds native Firestore TTL
// policies for dead docs (session and every handshake doc — TTL does not
// cascade to subcollections). It is never read for correctness; rules bound it
// to a generous 1h window.
function pairingSessionRef(rid, sessionId) {
  return doc(getFirestore(), 'familyPairing', rid, 'sessions', sessionId);
}

function pairingDocRef(rid, sessionId, party) {
  return doc(
    getFirestore(),
    'familyPairing',
    rid,
    'sessions',
    sessionId,
    'handshake',
    party,
  );
}

// GC deadline for every pairing doc: comfortably inside the rules' 1h bound so
// realistic device skew never denies a write (only TTL reads this value).
const PAIRING_TTL_EXPIRE_AT_MS = 30 * 60 * 1000;

/**
 * Open a JIT pairing session under the parent's username: create the session
 * doc (status WAITING, serverTimestamp createdAt, childUid null) under a fresh
 * makePairingCode() — the session doc id IS the secret 6-digit code, so there
 * is no pointer doc to leak the rendezvous. One doc write = atomic, and
 * sessions never collide (each pairing gets its own code), so there is no
 * "one live session" conflict to check. Returns the fresh code for the parent
 * to display.
 * Deliberately not wrapped in a catch — the caller distinguishes start errors.
 */
export async function createPairingSession(rid, parentWalletPub, { commit }) {
  const code = makePairingCode();
  const sessionRef = pairingSessionRef(rid, code);
  const expireAt = Timestamp.fromMillis(Date.now() + PAIRING_TTL_EXPIRE_AT_MS);

  await setDoc(sessionRef, {
    v: 1,
    status: 'WAITING',
    parentWalletPub,
    childUid: null,
    commit,
    createdAt: serverTimestamp(),
    expireAt,
  });
  return code;
}

/**
 * Child discovers + atomically claims the parent's WAITING session through the
 * rate-limited /childPairingClaim proxy endpoint (admin-mediated). The client can
 * no longer read the session (get oracle closed in firestore.rules) or blind-
 * claim it (client WAITING→JOINED deleted), so this Bearer-token call is the only
 * claim path — and the proxy's per-IP + per-uid limiters bound a code scan to
 * ~10/min. blitzProxyFetch sends the child's Firebase ID token; the server stamps
 * childUid from the VERIFIED token and returns the parent's commit for
 * verifyKeyCommitment. Returns { ok, commit, error }; a non-200 maps its server
 * error code to `error`. NOT the fetchBackend/httpsCallable ECDH path — that hits
 * GCF directly and would bypass the proxy and its limiter.
 */
export async function claimPairingSession(rid, code) {
  try {
    const res = await blitzProxyFetch('/childPairingClaim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: rid, code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== 'SUCCESS') {
      return { ok: false, error: data.error || 'request_failed' };
    }
    return { ok: true, commit: data.commit };
  } catch (e) {
    console.error('Error claiming pairing session:', e);
    return { ok: false, error: 'request_failed' };
  }
}

/**
 * Parent advances the session: JOINED→VERIFYING or VERIFYING→COMPLETED,
 * stamping the matching serverTimestamp. The COMPLETED call is strictly
 * best-effort (D5) — it may be rules-denied at the deadline boundary after the
 * grant already landed; neither party depends on it. Always returns a boolean;
 * callers must treat a false as non-fatal.
 */
export async function advanceSessionStatus(rid, sessionId, next) {
  try {
    if (next === 'VERIFYING') {
      await updateDoc(pairingSessionRef(rid, sessionId), {
        status: 'VERIFYING',
        verifyingAt: serverTimestamp(),
      });
    } else if (next === 'COMPLETED') {
      await updateDoc(pairingSessionRef(rid, sessionId), {
        status: 'COMPLETED',
        completedAt: serverTimestamp(),
      });
    } else {
      throw new Error(`Unknown session status advance: ${next}`);
    }
    return true;
  } catch (e) {
    console.error('Error advancing pairing session:', e);
    return false;
  }
}

/**
 * Mark a non-terminal session CANCELLED. Best-effort: denied once the session
 * is already terminal. Never throws.
 */
export async function cancelPairingSession(rid, sessionId) {
  try {
    await updateDoc(pairingSessionRef(rid, sessionId), { status: 'CANCELLED' });
    return true;
  } catch (e) {
    console.error('Error cancelling pairing session:', e);
    return false;
  }
}

export async function setPairingDoc(rid, sessionId, party, data) {
  try {
    await setDoc(pairingDocRef(rid, sessionId, party), {
      ...data,
      expireAt: Timestamp.fromMillis(Date.now() + PAIRING_TTL_EXPIRE_AT_MS),
    });
    return true;
  } catch (e) {
    console.error('Error writing pairing doc:', e);

    return false;
  }
}

export async function getPairingDoc(rid, sessionId, party) {
  try {
    const snap = await getDoc(pairingDocRef(rid, sessionId, party));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error('Error reading pairing doc:', e);
    return null;
  }
}

export function subscribePairingDoc(rid, sessionId, party, onData) {
  return onSnapshot(pairingDocRef(rid, sessionId, party), snap => {
    if (snap.exists()) onData(snap.data());
  });
}

// The session doc is the primary driver for both contexts: status transitions,
// serverTimestamp anchors for the countdown, and (null) when TTL GC'd the doc.
export function subscribePairingSession(rid, sessionId, onData) {
  let sawDoc = false;
  return onSnapshot(pairingSessionRef(rid, sessionId), snap => {
    if (snap.exists()) {
      sawDoc = true;
      onData(snap.data());
    } else if (sawDoc) {
      onData(null);
    }
  });
}

// Best-effort teardown: each party deletes its own handshake docs under the
// session. The rules deny deletes the caller doesn't own; those reject and are
// swallowed. Lingering peer docs TTL out. childUid now resolves from the
// session doc (not the childHello doc), so all deletes can fire in parallel.
export async function deletePairingHandshake(rid, sessionId) {
  await Promise.all(
    ['childHello', 'parentReveal', 'childConfirm', 'grant', 'cancel'].map(
      party => deleteDoc(pairingDocRef(rid, sessionId, party)).catch(() => {}),
    ),
  );
}

export async function handleGiftCheck(cardUUID) {
  try {
    const db = getFirestore();
    const docRef = doc(db, 'blitzGifts', cardUUID);

    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) return { didWork: true, wasClaimed: false };
    else return { didWork: true, wasClaimed: true };
  } catch (e) {
    console.error('Error adding gift to database: ', e);
    crashlyticsRecordErrorReport(e.message);
    return { didWork: false };
  }
}

export async function reloadGiftsOnDomesday(uuid) {
  try {
    const db = getFirestore();

    const q = query(
      collection(db, 'blitzGifts'),
      where('createdBy', '==', uuid),
    );

    const snapshot = await getDocs(q);

    const results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return results;
  } catch (e) {
    console.error('Error fetching gifts by creator:', e);
    return [];
  }
}

export async function addPoolToDatabase(poolData) {
  try {
    const db = getFirestore();
    const docRef = doc(db, 'blitzPools', poolData.poolId);
    await setDoc(docRef, poolData, { merge: false });
    console.log('Pool added with ID:', poolData.poolId);
    return true;
  } catch (e) {
    console.error('Error adding pool to database:', e);
    crashlyticsRecordErrorReport(e.message);
    return false;
  }
}

export async function updatePoolInDatabase(poolData) {
  try {
    const db = getFirestore();
    const docRef = doc(db, 'blitzPools', poolData.poolId);
    await setDoc(docRef, poolData, { merge: true });
    console.log('Pool updated with ID:', poolData.poolId);
    return true;
  } catch (e) {
    console.error('Error updating pool in database:', e);
    crashlyticsRecordErrorReport(e.message);
    return false;
  }
}

export async function getPoolFromDatabase(poolId) {
  try {
    const db = getFirestore();
    const docRef = doc(db, 'blitzPools', poolId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (e) {
    console.error('Error fetching pool from database:', e);
    crashlyticsRecordErrorReport(e.message);
    return null;
  }
}

export async function getPoolsByCreator(creatorUUID) {
  try {
    const db = getFirestore();
    const q = query(
      collection(db, 'blitzPools'),
      where('creatorUUID', '==', creatorUUID),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  } catch (e) {
    console.error('Error fetching pools by creator:', e);
    crashlyticsRecordErrorReport(e.message);
    return [];
  }
}

export async function deletePoolFromDatabase(poolId) {
  try {
    const db = getFirestore();
    const docRef = doc(db, 'blitzPools', poolId);
    await deleteDoc(docRef);
    console.log('Pool deleted:', poolId);
    return true;
  } catch (e) {
    console.error('Error deleting pool:', e);
    crashlyticsRecordErrorReport(e.message);
    return false;
  }
}

export async function getPoolContributions(poolId) {
  try {
    const db = getFirestore();
    const contribRef = collection(db, 'blitzPools', poolId, 'contributions');
    const q = query(contribRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error('Error fetching contributions:', e);
    crashlyticsRecordErrorReport(e.message);
    return [];
  }
}

export async function addContributionWithTransaction(
  poolId,
  contribution,
  amount,
) {
  const db = getFirestore();
  const poolRef = doc(db, 'blitzPools', poolId);
  const contribRef = doc(collection(db, 'blitzPools', poolId, 'contributions'));

  try {
    await runTransaction(db, async tx => {
      // REQUIRED read
      const poolSnap = await tx.get(poolRef);
      if (!poolSnap.exists()) {
        throw new Error('Pool does not exist');
      }

      const poolData = poolSnap.data();

      tx.set(contribRef, {
        ...contribution,
        contributionId: contribution.contributionId,
        poolId,
        createdAt: serverTimestamp(),
      });

      tx.update(poolRef, {
        currentAmount: poolData.currentAmount + amount,
        contributorCount: poolData.contributorCount + 1,
        lastContributionAt: serverTimestamp(),
      });
    });

    console.log('Pool contribution transaction committed:', poolId);
    return true;
  } catch (e) {
    console.error('Contribution transaction failed:', e);
    crashlyticsRecordErrorReport(e.message);
    return false;
  }
}

export async function getPoolContributionsSince(poolId, afterTimestampObj) {
  try {
    const db = getFirestore();
    const contribRef = collection(db, 'blitzPools', poolId, 'contributions');
    let afterTs = new Timestamp(0, 0);
    try {
      afterTs = new Timestamp(
        afterTimestampObj.seconds,
        afterTimestampObj.nanos ?? 0,
      );
    } catch (err) {
      console.log(err);
    }

    const q = query(
      contribRef,
      where('createdAt', '>', afterTs),
      orderBy('createdAt', 'desc'),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Error fetching contributions since timestamp:', e);
    crashlyticsRecordErrorReport(e.message);
    return [];
  }
}

export async function getPayLinkDoc(payLinkId) {
  try {
    const db = getFirestore();
    const docRef = doc(db, 'blitzPaylinks', payLinkId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists())
      return { didWork: false, error: 'Paylink not found' };
    return { didWork: true, data: snapshot.data() };
  } catch (e) {
    console.error('Error fetching paylink:', e);
    return { didWork: false, error: e.message };
  }
}
