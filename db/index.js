import {db} from './initializeFirebase';
import {
  getCachedMessages,
  queueSetCashedMessages,
} from '../app/functions/messaging/cachedMessages';

export async function addDataToCollection(dataObject, collection, uuid) {
  try {
    if (!uuid) throw Error('Not authenticated');
    const docRef = db.collection(collection).doc(uuid);

    console.log('New document information', dataObject);

    await docRef.set(dataObject, {merge: true});

    console.log('Document written with ID: ', uuid);

    return true;
  } catch (e) {
    console.error('Error adding document: ', e);
    return false;
  }
}

export async function getDataFromCollection(collectionName, uuid) {
  try {
    if (!uuid) throw Error('Not authenticated');

    const docRef = db.collection(collectionName).doc(uuid);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      return docSnap.data();
    }
  } catch (err) {
    console.log(err);
    return new Promise(resolve => {
      resolve(null);
    });
  }
}

export async function isValidUniqueName(
  collectionName = 'blitzWalletUsers',
  wantedName,
) {
  const querySnapshot = await db
    .collection(collectionName)
    .where('contacts.myProfile.uniqueNameLower', '==', wantedName.toLowerCase())
    .get();
  console.log(querySnapshot.empty);
  return querySnapshot.empty;
}

export async function getSignleContact(
  wantedName,
  collectionName = 'blitzWalletUsers',
) {
  const querySnapshot = await db
    .collection(collectionName)
    .where('contacts.myProfile.uniqueNameLower', '==', wantedName.toLowerCase())
    .get();
  return querySnapshot.docs.map(doc => doc.data());
}
export async function canUsePOSName(
  collectionName = 'blitzWalletUsers',
  wantedName,
) {
  const querySnapshot = await db
    .collection(collectionName)
    .where('posSettings.storeNameLower', '==', wantedName.toLowerCase())
    .get();
  return querySnapshot.empty;
}

// Function to search users by username
export async function searchUsers(
  searchTerm,
  collectionName = 'blitzWalletUsers',
) {
  let parsedSearchTerm = searchTerm.trim();
  console.log(parsedSearchTerm, 'in function searchterm');
  if (!parsedSearchTerm || !parsedSearchTerm.length) return []; // Return an empty array if the search term is empty
  console.log('running search');
  try {
    const uniqueNameQuery = (
      await db
        .collection(collectionName)
        .where(
          'contacts.myProfile.uniqueNameLower',
          '>=',
          parsedSearchTerm.toLowerCase(),
        )
        .where(
          'contacts.myProfile.uniqueNameLower',
          '<=',
          parsedSearchTerm.toLowerCase() + '\uf8ff',
        )
        .limit(10)
        .get()
    ).docs.map(doc => doc.data());

    const nameQuery = (
      await db
        .collection(collectionName)
        .where(
          'contacts.myProfile.nameLower',
          '>=',
          parsedSearchTerm.toLowerCase(),
        )
        .where(
          'contacts.myProfile.nameLower',
          '<=',
          parsedSearchTerm.toLowerCase() + '\uf8ff',
        )
        .limit(10)
        .get()
    ).docs.map(doc => doc.data());

    const [uniqueNameSnapshot, nameSnapshot] = await Promise.all([
      uniqueNameQuery,
      nameQuery,
    ]);

    const uniqueUsers = new Map();

    [...uniqueNameSnapshot, ...nameSnapshot].forEach(doc => {
      const profile = doc.contacts?.myProfile;

      if (profile) {
        uniqueUsers.set(profile.uuid, profile);
      }
    });
    const users = Array.from(uniqueUsers.values());

    return users;
  } catch (error) {
    console.error('Error searching users: ', error);
    return [];
  }
}

export async function getUnknownContact(
  uuid,
  collectionName = 'blitzWalletUsers',
) {
  try {
    const unkownContact = await db.collection(collectionName).doc(uuid).get();

    if (unkownContact.exists) {
      const data = unkownContact.data();
      return data;
    } else {
      return false;
    }
  } catch (err) {
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
    const docSnap = db.collection('contactMessages');

    const timestamp = new Date().getTime();

    const message = {
      fromPubKey: fromPubKey,
      toPubKey: toPubKey,
      message: newMessage,
      timestamp,
    };

    if (onlySaveToLocal) {
      queueSetCashedMessages({
        newMessagesList: [message],
        myPubKey: fromPubKey,
      });
      return;
    }

    await docSnap.add(message);
    console.log('New messaged was published started:', message);
    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
}

export async function syncDatabasePayment(
  myPubKey,
  updatedCachedMessagesStateFunction,
) {
  try {
    const cachedConversations = await getCachedMessages();

    const savedMillis = cachedConversations.lastMessageTimestamp;

    console.log('retriving docs from this timestamp:', savedMillis);

    const receivedMessages = await db
      .collection('contactMessages')
      .where('toPubKey', '==', myPubKey)
      .where('timestamp', '>', savedMillis)
      .get();

    const sentMessages = await db
      .collection('contactMessages')
      .where('fromPubKey', '==', myPubKey)
      .where('timestamp', '>', savedMillis)
      .get();

    if (receivedMessages.empty && sentMessages.empty) {
      updatedCachedMessagesStateFunction();
      return;
    }
    console.log(
      receivedMessages.docs.length,
      sentMessages.docs.length,
      'messages received fromm history',
    );

    let messsageList = [];

    for (const doc of receivedMessages.docs.concat(sentMessages.docs)) {
      const data = doc.data();
      messsageList.push(data);
    }

    queueSetCashedMessages({
      newMessagesList: messsageList,
      myPubKey,
    });
  } catch (err) {
    console.log('sync database payment err', err);
  }
}
