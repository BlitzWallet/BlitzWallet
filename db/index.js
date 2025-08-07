import {db} from './initializeFirebase';
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
} from '@react-native-firebase/firestore';
import {getLocalStorageItem, setLocalStorageItem} from '../app/functions';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../app/functions/crashlyticsLogs';
import {
  decryptMessage,
  encriptMessage,
} from '../app/functions/messaging/encodingAndDecodingMessages';
export const LOCAL_STORED_USER_DATA_KEY = 'LOCAL_USER_OBJECT';

export async function addDataToCollection(dataObject, collectionName, uuid) {
  try {
    if (!uuid) throw Error('Not authenticated');
    crashlyticsLogReport('Starting to add data to collection');

    const db = getFirestore();
    const docRef = doc(db, collectionName, uuid);

    await setDoc(docRef, dataObject, {merge: true});

    console.log('Document merged with ID: ', uuid);
    return true;
  } catch (e) {
    console.error('Error adding document: ', e);
    crashlyticsRecordErrorReport(e.message);
    return false;
  }
}

const saveToLocalDB = async dataObject => {
  try {
    const existingData = await getLocalStorageItem(LOCAL_STORED_USER_DATA_KEY);
    let userData = existingData ? JSON.parse(existingData) : {};

    // Merge new data with existing local user data
    userData = {...userData, ...dataObject};

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

      if (docSnap.exists) {
        const userData = docSnap.data();
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

    return {success: true, count: paymentIds.length};
  } catch (err) {
    console.error('Error batch deleting payments:', err);
    return {success: false, message: err.message};
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
    crashlyticsRecordErrorReport(err.message);
    return false;
  }
}
export async function syncDatabasePayment(
  myPubKey,
  updatedCachedMessagesStateFunction,
  privateKey,
) {
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

    if (allMessages.length === 0) {
      updatedCachedMessagesStateFunction();
      return;
    }

    console.log(`${allMessages.length} messages received from history`);

    const processedMessages = await processWithRAF(
      allMessages,
      myPubKey,
      privateKey,
    );

    queueSetCashedMessages({
      newMessagesList: processedMessages,
      myPubKey,
    });
  } catch (err) {
    console.error('Error syncing database payments:', err);
    crashlyticsLogReport(err.message);
    updatedCachedMessagesStateFunction();
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
            processedMessages.push({...message, message: parsedMessage});
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

    await setDoc(docRef, dataObject, {merge: true});

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
    crashlyticsLogReport('Starting to add data to collection');

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
