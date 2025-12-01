import React, {
  createContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  addDataToCollection,
  getDataFromCollection,
  syncDatabasePayment,
} from '../db';
import {
  decryptMessage,
  encriptMessage,
} from '../app/functions/messaging/encodingAndDecodingMessages';

import {
  CONTACTS_TRANSACTION_UPDATE_NAME,
  contactsSQLEventEmitter,
  getCachedMessages,
  queueSetCashedMessages,
} from '../app/functions/messaging/cachedMessages';
import { db } from '../db/initializeFirebase';
import { useKeysContext } from './keys';
import {
  collection,
  onSnapshot,
  or,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';
import { getCachedProfileImage } from '../app/functions/cachedImage';

// Create a context for the WebView ref
const GlobalContacts = createContext(null);

export const GlobalContactsList = ({ children }) => {
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const [globalContactsInformation, setGlobalContactsInformation] = useState(
    {},
  );
  const [contactsMessags, setContactsMessagses] = useState({});
  const lookForNewMessages = useRef(false);
  const unsubscribeMessagesRef = useRef(null);
  const addedContacts = globalContactsInformation.addedContacts;

  const toggleGlobalContactsInformation = useCallback(
    (newData, writeToDB) => {
      setGlobalContactsInformation(prev => {
        const newContacts = { ...prev, ...newData };
        if (writeToDB) {
          addDataToCollection(
            { contacts: newContacts },
            'blitzWalletUsers',
            publicKey,
          );
        }
        return newContacts;
      });
    },
    [publicKey],
  );

  const decodedAddedContacts = useMemo(() => {
    if (!publicKey || !addedContacts) return [];
    return typeof addedContacts === 'string'
      ? [
          ...JSON.parse(
            decryptMessage(contactsPrivateKey, publicKey, addedContacts),
          ),
        ]
      : [];
  }, [addedContacts, publicKey, contactsPrivateKey]);

  const updatedCachedMessagesStateFunction = useCallback(async () => {
    if (!Object.keys(globalContactsInformation).length || !contactsPrivateKey)
      return;
    const savedMessages = await getCachedMessages();
    setContactsMessagses(savedMessages);
    const unknownContacts = await Promise.all(
      Object.keys(savedMessages)
        .filter(key => key !== 'lastMessageTimestamp')
        .filter(
          contact =>
            !decodedAddedContacts.find(
              contactElement => contactElement.uuid === contact,
            ) && contact !== globalContactsInformation.myProfile.uuid,
        )
        .map(contact => getDataFromCollection('blitzWalletUsers', contact)),
    );

    const newContats = unknownContacts
      .filter(
        retrivedContact =>
          retrivedContact &&
          retrivedContact.uuid !== globalContactsInformation.myProfile.uuid,
      )
      .map(retrivedContact => ({
        bio: retrivedContact.contacts.myProfile.bio || 'No bio',
        isFavorite: false,
        name: retrivedContact.contacts.myProfile.name,
        receiveAddress: retrivedContact.contacts.myProfile.receiveAddress,
        uniqueName: retrivedContact.contacts.myProfile.uniqueName,
        uuid: retrivedContact.contacts.myProfile.uuid,
        isAdded: false,
        unlookedTransactions: 0,
      }));

    if (newContats.length > 0) {
      await Promise.allSettled(
        newContats.map(contact => getCachedProfileImage(contact.uuid)),
      );

      toggleGlobalContactsInformation(
        {
          myProfile: { ...globalContactsInformation.myProfile },
          addedContacts: encriptMessage(
            contactsPrivateKey,
            globalContactsInformation.myProfile.uuid,
            JSON.stringify(decodedAddedContacts.concat(newContats)),
          ),
        },
        true,
      );
    }
  }, [globalContactsInformation, decodedAddedContacts, contactsPrivateKey]);

  useEffect(() => {
    async function handleUpdate(updateType) {
      try {
        console.log('Received contact transaction update type', updateType);
        updatedCachedMessagesStateFunction();
      } catch (err) {
        console.log('error in contact messages update function', err);
      }
    }
    contactsSQLEventEmitter.removeAllListeners(
      CONTACTS_TRANSACTION_UPDATE_NAME,
    );
    contactsSQLEventEmitter.on(CONTACTS_TRANSACTION_UPDATE_NAME, handleUpdate);

    return () => {
      contactsSQLEventEmitter.removeAllListeners(
        CONTACTS_TRANSACTION_UPDATE_NAME,
      );
    };
  }, [updatedCachedMessagesStateFunction]);

  useEffect(() => {
    if (!Object.keys(globalContactsInformation).length) return;
    const now = new Date().getTime();

    // Unsubscribe from previous listeners before setting new ones
    if (unsubscribeMessagesRef.current) {
      unsubscribeMessagesRef.current();
    }

    const combinedMessageQuery = query(
      collection(db, 'contactMessages'),
      where('timestamp', '>', now),
      or(
        where('toPubKey', '==', globalContactsInformation.myProfile.uuid),
        where('fromPubKey', '==', globalContactsInformation.myProfile.uuid),
      ),
      orderBy('timestamp'),
    );

    unsubscribeMessagesRef.current = onSnapshot(
      combinedMessageQuery,
      snapshot => {
        if (!snapshot?.docChanges()?.length) return;
        let newMessages = [];
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const newMessage = change.doc.data();
            // Log whether it's sent or received
            const isReceived =
              newMessage.toPubKey === globalContactsInformation.myProfile.uuid;
            console.log(
              `${isReceived ? 'received' : 'sent'} a new message`,
              newMessage,
            );
            if (typeof newMessage.message === 'string') {
              const sendersPubkey =
                newMessage.toPubKey === globalContactsInformation.myProfile.uuid
                  ? newMessage.fromPubKey
                  : newMessage.toPubKey;
              const decoded = decryptMessage(
                contactsPrivateKey,
                sendersPubkey,
                newMessage.message,
              );

              if (!decoded) return;
              let parsedMessage;
              try {
                parsedMessage = JSON.parse(decoded);
              } catch (err) {
                console.log('error parsing decoded message', err);
                return;
              }
              newMessages.push({
                ...newMessage,
                message: parsedMessage,
                sendersPubkey,
                isReceived,
              });
            } else newMessages.push(newMessage);
          }
        });
        if (newMessages.length > 0) {
          queueSetCashedMessages({
            newMessagesList: newMessages,
            myPubKey: globalContactsInformation.myProfile.uuid,
          });
        }
      },
    );

    return () => {
      if (unsubscribeMessagesRef.current) {
        unsubscribeMessagesRef.current();
      }
    };
  }, [globalContactsInformation?.myProfile?.uuid, contactsPrivateKey]);

  useEffect(() => {
    if (!Object.keys(globalContactsInformation).length) return;
    if (lookForNewMessages.current) return;
    lookForNewMessages.current = true;
    syncDatabasePayment(
      globalContactsInformation.myProfile.uuid,
      updatedCachedMessagesStateFunction,
      contactsPrivateKey,
    );
  }, [
    globalContactsInformation,
    updatedCachedMessagesStateFunction,
    contactsPrivateKey,
  ]);

  const giftCardsList = useMemo(() => {
    if (!contactsMessags) return [];

    const actualContacts = Object.keys(contactsMessags);
    const lastMessageTimestampIndex = actualContacts.indexOf(
      'lastMessageTimestamp',
    );

    // Remove lastMessageTimestamp efficiently
    if (lastMessageTimestampIndex > -1) {
      actualContacts.splice(lastMessageTimestampIndex, 1);
    }

    if (actualContacts.length === 0) return [];

    const giftCards = [];

    // Process contacts efficiently
    for (const contact of actualContacts) {
      const contactData = contactsMessags[contact];
      if (!contactData?.messages?.length) continue;

      // Use for loop for better performance than filter + push
      const messages = contactData.messages;
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        if (message.message?.giftCardInfo && !message.message.didSend) {
          giftCards.push(message);
        }
      }
    }

    // Sort in-place for memory efficiency
    giftCards.sort((a, b) => {
      const timeA = a.serverTimestamp || a.timestamp;
      const timeB = b.serverTimestamp || b.timestamp;
      return timeB - timeA;
    });

    return giftCards;
  }, [contactsMessags]);

  const hasUnlookedTransactions = useMemo(() => {
    return Object.keys(contactsMessags).some(contactUUID => {
      if (
        contactUUID === 'lastMessageTimestamp' ||
        contactUUID === globalContactsInformation?.myProfile?.uuid
      ) {
        return false;
      }
      const messages = contactsMessags[contactUUID]?.messages;
      return messages?.some(message => !message.message.wasSeen) || false;
    });
  }, [contactsMessags, globalContactsInformation?.myProfile?.uuid]);

  const contextValue = useMemo(
    () => ({
      decodedAddedContacts,
      globalContactsInformation,
      toggleGlobalContactsInformation,
      contactsMessags,
      updatedCachedMessagesStateFunction,
      giftCardsList,
      hasUnlookedTransactions,
    }),
    [
      decodedAddedContacts,
      globalContactsInformation,
      toggleGlobalContactsInformation,
      contactsMessags,
      updatedCachedMessagesStateFunction,
      giftCardsList,
      hasUnlookedTransactions,
    ],
  );

  return (
    <GlobalContacts.Provider value={contextValue}>
      {children}
    </GlobalContacts.Provider>
  );
};

export const useGlobalContacts = () => {
  return React.useContext(GlobalContacts);
};
