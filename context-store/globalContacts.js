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
  bulkGetUnknownContacts,
  getUnknownContact,
  syncDatabasePayment,
} from '../db';
import {
  decryptMessage,
  encriptMessage,
} from '../app/functions/messaging/encodingAndDecodingMessages';
import {getLocalStorageItem} from '../app/functions';
import {
  getCurrentDateFormatted,
  isMoreThan21Days,
} from '../app/functions/rotateAddressDateChecker';
import {
  CONTACTS_TRANSACTION_UPDATE_NAME,
  contactsSQLEventEmitter,
  getCachedMessages,
  queueSetCashedMessages,
} from '../app/functions/messaging/cachedMessages';
import {db} from '../db/initializeFirebase';
import {useKeysContext} from './keys';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
} from '@react-native-firebase/firestore';

// Create a context for the WebView ref
const GlobalContacts = createContext(null);

export const GlobalContactsList = ({children}) => {
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const [globalContactsInformation, setGlobalContactsInformation] = useState(
    {},
  );
  const [myProfileImage, setMyProfileImage] = useState('');
  const [contactsMessags, setContactsMessagses] = useState({});

  const didTryToUpdate = useRef(false);
  const lookForNewMessages = useRef(false);
  const unsubscribeMessagesRef = useRef(null);
  const unsubscribeSentMessagesRef = useRef(null);

  const addedContacts = globalContactsInformation.addedContacts;

  const toggleGlobalContactsInformation = useCallback(
    (newData, writeToDB) => {
      setGlobalContactsInformation(prev => {
        const newContacts = {...prev, ...newData};
        if (writeToDB) {
          addDataToCollection(
            {contacts: newContacts},
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
        .map(contact => getUnknownContact(contact, 'blitzWalletUsers')),
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
      toggleGlobalContactsInformation(
        {
          myProfile: {...globalContactsInformation.myProfile},
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
    (async () => {
      const profileImage = (await getLocalStorageItem('myProfileImage')) || '';
      setMyProfileImage(profileImage);
    })();
  }, []);

  useEffect(() => {
    async function handleUpdate(updateType) {
      try {
        console.log('Received contact transaction update type', updateType);
        updatedCachedMessagesStateFunction();
      } catch (err) {
        console.log('error in contact messages update function', err);
      }
    }
    contactsSQLEventEmitter.off(CONTACTS_TRANSACTION_UPDATE_NAME, handleUpdate);
    contactsSQLEventEmitter.on(CONTACTS_TRANSACTION_UPDATE_NAME, handleUpdate);

    return () => {
      contactsSQLEventEmitter.off(
        CONTACTS_TRANSACTION_UPDATE_NAME,
        handleUpdate,
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
    if (unsubscribeSentMessagesRef.current) {
      unsubscribeSentMessagesRef.current();
    }
    const inboundMessageQuery = query(
      collection(db, 'contactMessages'),
      where('toPubKey', '==', globalContactsInformation.myProfile.uuid),
      orderBy('timestamp'),
      startAfter(now),
    );
    const outbounddMessageQuery = query(
      collection(db, 'contactMessages'),
      where('fromPubKey', '==', globalContactsInformation.myProfile.uuid),
      orderBy('timestamp'),
      startAfter(now),
    );

    // Set up the realtime listener
    unsubscribeMessagesRef.current = onSnapshot(
      inboundMessageQuery,
      snapshot => {
        if (!snapshot?.docChanges()?.length) return;

        snapshot.docChanges().forEach(change => {
          console.log('received a new message', change.type);
          if (change.type === 'added') {
            const newMessage = change.doc.data();
            queueSetCashedMessages({
              newMessagesList: [newMessage],
              myPubKey: globalContactsInformation.myProfile.uuid,
            });
          }
        });
      },
    );

    unsubscribeSentMessagesRef.current = onSnapshot(
      outbounddMessageQuery,
      snapshot => {
        if (!snapshot?.docChanges()?.length) return;
        snapshot.docChanges().forEach(change => {
          console.log('sent a new message', change.type);
          if (change.type === 'added') {
            const newMessage = change.doc.data();
            queueSetCashedMessages({
              newMessagesList: [newMessage],
              myPubKey: globalContactsInformation.myProfile.uuid,
            });
          }
        });
      },
    );

    return () => {
      if (unsubscribeMessagesRef.current) {
        unsubscribeMessagesRef.current();
      }
      if (unsubscribeSentMessagesRef.current) {
        unsubscribeSentMessagesRef.current();
      }
    };
  }, [globalContactsInformation?.myProfile?.uuid]);

  useEffect(() => {
    if (!Object.keys(globalContactsInformation).length) return;
    if (lookForNewMessages.current) return;
    lookForNewMessages.current = true;
    syncDatabasePayment(
      globalContactsInformation.myProfile.uuid,
      updatedCachedMessagesStateFunction,
    );
  }, [globalContactsInformation, updatedCachedMessagesStateFunction]);

  // No longer need to handle this manualy as it happens automaticly from peoples activity
  // useEffect(() => {
  //   if (
  //     !Object.keys(globalContactsInformation).length ||
  //     !contactsPrivateKey ||
  //     !publicKey
  //   )
  //     return;
  //   if (didTryToUpdate.current) return;
  //   didTryToUpdate.current = true;

  //   const updateContactsAddresses = async () => {
  //     if (
  //       !decodedAddedContacts ||
  //       decodedAddedContacts.length === 0 ||
  //       !isMoreThan21Days(
  //         globalContactsInformation.myProfile?.lastRotatedAddedContact,
  //       )
  //     )
  //       return;

  //     // break array into size of 10 to meet firestore limits
  //     const chunkArray = (arr, size) =>
  //       arr.length > size
  //         ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)]
  //         : [arr];

  //     // take document uuids from valid contacts (LNURL address does not need to be looked up)
  //     const uuidChunks = chunkArray(
  //       decodedAddedContacts.map(c => !c.isLNURL && c.uuid),
  //       10,
  //     );

  //     console.log('uuid chunks', uuidChunks);

  //     // Request database for updated contact addresses
  //     const bulkResults = (
  //       await Promise.all(
  //         uuidChunks.map(uuids => bulkGetUnknownContacts(uuids)),
  //       )
  //     )
  //       .flat()
  //       .filter(Boolean);

  //     // create an object of {id:address}
  //     const uuidToAddressMap = bulkResults.reduce((acc, doc) => {
  //       const uuid = doc.contacts.myProfile?.uuid;
  //       if (uuid) acc[uuid] = doc.contacts.myProfile.receiveAddress;
  //       return acc;
  //     }, {});

  //     console.log('uuid address map', uuidToAddressMap);
  //     // Updated saved contacts address to new address if they have changed but skip LNURL
  //     const updatedContactsAddress = decodedAddedContacts.map(contact => {
  //       const newAddress = uuidToAddressMap[contact.uuid];
  //       return newAddress &&
  //         newAddress !== contact.receiveAddress &&
  //         !contact.isLNURL
  //         ? {...contact, receiveAddress: newAddress}
  //         : contact;
  //     });

  //     toggleGlobalContactsInformation(
  //       {
  //         myProfile: {
  //           ...globalContactsInformation.myProfile,
  //           lastRotatedAddedContact: getCurrentDateFormatted(),
  //         },
  //         addedContacts: encriptMessage(
  //           contactsPrivateKey,
  //           publicKey,
  //           JSON.stringify(updatedContactsAddress),
  //         ),
  //       },
  //       true,
  //     );
  //   };

  //   updateContactsAddresses();
  // }, [
  //   globalContactsInformation,
  //   decodedAddedContacts,
  //   contactsPrivateKey,
  //   publicKey,
  // ]);

  return (
    <GlobalContacts.Provider
      value={{
        decodedAddedContacts,
        globalContactsInformation,
        toggleGlobalContactsInformation,
        setMyProfileImage,
        myProfileImage,
        contactsMessags,
        updatedCachedMessagesStateFunction,
      }}>
      {children}
    </GlobalContacts.Provider>
  );
};

export const useGlobalContacts = () => {
  return React.useContext(GlobalContacts);
};
