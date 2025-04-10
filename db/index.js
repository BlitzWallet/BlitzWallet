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
} from '@react-native-firebase/firestore';
import {getLocalStorageItem, setLocalStorageItem} from '../app/functions';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../app/functions/crashlyticsLogs';
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

export async function getUnknownContact(
  uuid,
  collectionName = 'blitzWalletUsers',
) {
  try {
    crashlyticsLogReport('Getting unkown contact');
    const docRef = doc(db, collectionName, uuid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists) {
      return docSnap.data();
    }
    return false;
  } catch (err) {
    console.error('Error fetching unknown contact:', err);
    crashlyticsRecordErrorReport(err.message);
    return null;
  }
}

export async function bulkGetUnknownContacts(
  uuidList,
  collectionName = 'blitzWalletUsers',
) {
  crashlyticsLogReport('Starting bunk get unkown contacts');
  // Validate input
  if (!Array.isArray(uuidList) || uuidList.length === 0) {
    console.warn('Invalid UUID list provided');
    return [];
  }

  // Firestore 'in' queries are limited to 10 items in v9
  const MAX_IN_CLAUSE = 10;
  const chunks = [];

  // Split into chunks of 10 UUIDs each
  for (let i = 0; i < uuidList.length; i += MAX_IN_CLAUSE) {
    chunks.push(uuidList.slice(i, i + MAX_IN_CLAUSE));
  }

  try {
    const results = [];

    // Process each chunk sequentially to avoid overwhelming Firestore
    for (const chunk of chunks) {
      const usersRef = collection(db, collectionName);
      const q = query(usersRef, where('contacts.myProfile.uuid', 'in', chunk));

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        results.push(...snapshot.docs.map(doc => doc.data()));
      }
    }

    return results.length > 0 ? results : null;
  } catch (err) {
    console.error('Error fetching bulk contacts:', err);
    crashlyticsRecordErrorReport(err.message);
    return null;
  }
}

export async function updateMessage({
  newMessage,
  fromPubKey,
  toPubKey,
  onlySaveToLocal,
}) {
  try {
    crashlyticsLogReport('Starting updating contact message');
    const messagesRef = collection(db, 'contactMessages');
    const timestamp = new Date().getTime();

    const message = {
      fromPubKey,
      toPubKey,
      message: newMessage,
      timestamp,
    };

    if (onlySaveToLocal) {
      queueSetCashedMessages({
        newMessagesList: [message],
        myPubKey: fromPubKey,
      });
      return true;
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
) {
  try {
    crashlyticsLogReport('Starting sync database payments');
    const cachedConversations = await getCachedMessages();
    const savedMillis = cachedConversations.lastMessageTimestamp;
    console.log('Retrieving docs from timestamp:', savedMillis);
    const messagesRef = collection(db, 'contactMessages');

    const receivedMessagesQuery = query(
      messagesRef,
      where('toPubKey', '==', myPubKey),
      where('timestamp', '>', savedMillis),
    );

    const sentMessagesQuery = query(
      messagesRef,
      where('fromPubKey', '==', myPubKey),
      where('timestamp', '>', savedMillis),
    );

    const [receivedSnapshot, sentSnapshot] = await Promise.all([
      getDocs(receivedMessagesQuery),
      getDocs(sentMessagesQuery),
    ]);

    const receivedMessages = receivedSnapshot.docs.map(doc => doc.data());
    const sentMessages = sentSnapshot.docs.map(doc => doc.data());
    const allMessages = [...receivedMessages, ...sentMessages];

    if (allMessages.length === 0) {
      updatedCachedMessagesStateFunction();
      return;
    }

    console.log(`${allMessages.length} messages received from history`);

    queueSetCashedMessages({
      newMessagesList: allMessages,
      myPubKey,
    });
  } catch (err) {
    console.error('Error syncing database payments:', err);
    crashlyticsLogReport(err.message);
    // Consider adding error handling callback if needed
    updatedCachedMessagesStateFunction();
  }
}
