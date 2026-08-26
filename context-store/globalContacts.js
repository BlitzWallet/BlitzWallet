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
  getSingleContact,
  syncDatabasePayment,
} from '../db';
import {
  decryptMessage,
  encriptMessage,
} from '../app/functions/messaging/encodingAndDecodingMessages';
import {
  getLocalStorageItem,
  removeLocalStorageItem,
} from '../app/functions/localStorage';
import { PENDING_PARENT_CONTACT_KEY } from '../app/constants';
import {
  clearContactRaceRetryTimers,
  CONTACTS_TRANSACTION_UPDATE_NAME,
  contactsSQLEventEmitter,
  deleteCachedMessages,
  getCachedMessages,
  queueSetCashedMessages,
  startContactPaymentMatchRetrySequance,
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
import { useAuthContext } from './authContext';
import { useAppStatus } from './appStatus';
import {
  isParentAccountTransferSender,
  PARENT_ACCOUNT_TRANSFER_MARKER,
} from '../app/functions/messaging/parentAccountTransferMessage';

// ─── Split contexts ────────────────────────────────────────────────────────────
// Consumers that only need profile/contacts info won't re-render when messages
// change, and vice-versa.
const GlobalContactsInfoContext = createContext(null);
const GlobalContactsMessagesContext = createContext(null);

const normalizeContactReceiveOption = receiveOption =>
  receiveOption?.toString()?.toLowerCase() === 'usd' ? 'USD' : 'BTC';

export const GlobalContactsList = ({ children }) => {
  const { authResetkey } = useAuthContext();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const [globalContactsInformation, setGlobalContactsInformation] = useState(
    {},
  );
  const { didGetToHomepage } = useAppStatus();
  const [contactsMessags, setContactsMessagses] = useState({});
  const unsubscribeMessagesRef = useRef(null);
  const isInitialLoad = useRef(true);
  const addedParentContactRef = useRef(false);

  const globalContactsInformationRef = useRef(globalContactsInformation);
  useEffect(() => {
    globalContactsInformationRef.current = globalContactsInformation;
  });

  const addedContacts = globalContactsInformation.addedContacts;

  const toggleGlobalContactsInformation = useCallback(
    (newData, writeToDB) => {
      setGlobalContactsInformation(prev => {
        const resolved = typeof newData === 'function' ? newData(prev) : newData;
        // A functional payload may return null/undefined to abort (e.g. a
        // failed encryption) — never merge that over live state.
        if (!resolved) return prev;
        const newContacts = { ...prev, ...resolved };
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

  const getContactReceiveOption = useCallback(async contactUUID => {
    if (!contactUUID) return { receiveOption: null, contactDoc: null };

    const contactDoc = await getDataFromCollection(
      'blitzWalletUsers',
      contactUUID,
    );

    if (!contactDoc) return { receiveOption: null, contactDoc: null };

    return {
      receiveOption: normalizeContactReceiveOption(
        contactDoc.lnurlReceiveCurrency,
      ),
      contactDoc,
    };
  }, []);

  const decodedAddedContacts = useMemo(() => {
    if (!publicKey || !addedContacts) return [];

    if (typeof addedContacts !== 'string') return [];

    try {
      const decryptedData = decryptMessage(
        contactsPrivateKey,
        publicKey,
        addedContacts,
      );

      return [...JSON.parse(decryptedData)];
    } catch (error) {
      console.warn('Failed to parse addedContacts.', error);
      return [];
    }
  }, [addedContacts, publicKey, contactsPrivateKey]);

  const decodedAddedContactsRef = useRef(decodedAddedContacts);
  useEffect(() => {
    decodedAddedContactsRef.current = decodedAddedContacts;
  });

  const updatedCachedMessagesStateFunction = useCallback(async () => {
    const currentInfo = globalContactsInformationRef.current;
    if (!Object.keys(currentInfo).length || !contactsPrivateKey) return;

    try {
      const savedMessages = await getCachedMessages();
      setContactsMessagses(savedMessages);

      const currentDecoded = decodedAddedContactsRef.current;

      const unknownContacts = await Promise.all(
        Object.keys(savedMessages)
          .filter(key => key !== 'lastMessageTimestamp')
          .filter(
            contact =>
              !currentDecoded.find(
                contactElement => contactElement.uuid === contact,
              ) && contact !== currentInfo.myProfile.uuid,
          )
          // Parent↔child account transfers are description-only: the sender is
          // not a real contact and must never be auto-added.
          .filter(
            contact => !isParentAccountTransferSender(savedMessages, contact),
          )
          .map(contact => getDataFromCollection('blitzWalletUsers', contact)),
      );

      const newContats = unknownContacts
        .filter(
          retrivedContact =>
            retrivedContact &&
            retrivedContact.uuid !== currentInfo.myProfile.uuid,
        )
        .map(retrivedContact => ({
          bio: retrivedContact.contacts.myProfile.bio || '',
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

        // Read the latest decoded contacts at the moment we write
        const latestDecoded = decodedAddedContactsRef.current ?? [];
        const latestInfo = globalContactsInformationRef.current;

        if (!latestInfo?.myProfile) return;

        const trulyNewContacts = newContats.filter(
          c => !latestDecoded.find(existing => existing.uuid === c.uuid),
        );

        if (trulyNewContacts.length > 0) {
          toggleGlobalContactsInformation(
            {
              myProfile: { ...latestInfo.myProfile },
              addedContacts: encriptMessage(
                contactsPrivateKey,
                latestInfo.myProfile.uuid,
                JSON.stringify(latestDecoded.concat(trulyNewContacts)),
              ),
            },
            true,
          );
        }
      }
    } catch (err) {
      console.log('error updating dached messages', err);
    }
  }, [contactsPrivateKey, toggleGlobalContactsInformation]);

  useEffect(() => {
    async function handleUpdate(updateType) {
      try {
        console.log('Received contact transaction update type', updateType);
        if (updateType === 'hanleContactRace') {
          // If the update type is "handle race", we have not yet received the payment
          // event from Spark. A race condition can occur where a Firebase DB event
          // fires at the same time the corresponding Spark transaction is saved to
          // Spark’s SQL database. In this case, the description and contact information
          // from Firebase may not be attached to the Spark transaction.
          //
          // To mitigate this, we use an exponential backoff that repeatedly checks
          // saved transactions (specifically incoming transactions that do not yet
          // have a corresponding Spark transaction). This reduces the chance that
          // the transaction is saved without the associated metadata.
          startContactPaymentMatchRetrySequance();
          return;
        }
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
      clearContactRaceRetryTimers();
    };
  }, [updatedCachedMessagesStateFunction]);

  const updateContactUniqueName = useCallback(
    async newUniqueNames => {
      if (newUniqueNames.size === 0) {
        return;
      }

      setGlobalContactsInformation(prev => {
        try {
          // Validate prerequisites
          if (!contactsPrivateKey || !publicKey) {
            console.warn('Missing required data for contact update');
            return prev;
          }

          let currentContacts;
          try {
            const decryptedData = decryptMessage(
              contactsPrivateKey,
              publicKey,
              prev.addedContacts,
            );

            if (!decryptedData) {
              console.warn('Decryption returned empty data');
              return prev;
            }

            currentContacts = JSON.parse(decryptedData);

            // Validate parsed data
            if (!Array.isArray(currentContacts)) {
              console.warn('Decrypted contacts is not an array');
              return prev;
            }
          } catch (decryptError) {
            console.error(
              'Failed to decode contacts for update:',
              decryptError,
            );
            return prev;
          }

          let hasChanges = false;
          const updatedContacts = currentContacts.map(contact => {
            const newUniqueName = newUniqueNames.get(contact.uuid);

            if (
              newUniqueName &&
              typeof newUniqueName === 'string' &&
              newUniqueName.trim() !== '' &&
              newUniqueName !== contact.uniqueName
            ) {
              hasChanges = true;
              return {
                ...contact,
                uniqueName: newUniqueName,
              };
            }

            return contact;
          });

          if (!hasChanges) {
            return prev;
          }

          const newEncryptedContacts = encriptMessage(
            contactsPrivateKey,
            publicKey,
            JSON.stringify(updatedContacts),
          );

          if (!newEncryptedContacts) {
            console.error('Encryption failed, aborting update');
            return prev;
          }

          addDataToCollection(
            {
              contacts: {
                ...prev,
                addedContacts: newEncryptedContacts,
              },
            },
            'blitzWalletUsers',
            publicKey,
          ).catch(dbError => {
            console.error('Failed to save contacts to database:', dbError);
          });

          return {
            ...prev,
            addedContacts: newEncryptedContacts,
          };
        } catch (stateError) {
          console.error('Error in state update function:', stateError);
          return prev;
        }
      });
    },
    [contactsPrivateKey, publicKey],
  );

  const myProfileUUID = globalContactsInformation?.myProfile?.uuid;

  useEffect(() => {
    // Set timestamp to last conversation to retrive historical messages
    if (!myProfileUUID || !contactsPrivateKey) return;

    async function handleListener() {
      const cachedConversations = await getCachedMessages();
      const savedMillis = cachedConversations.lastMessageTimestamp;

      // Unsubscribe from previous listeners before setting new ones
      if (unsubscribeMessagesRef.current) {
        unsubscribeMessagesRef.current();
      }

      const combinedMessageQuery = query(
        collection(db, 'contactMessages'),
        where('timestamp', '>', savedMillis),
        or(
          where('toPubKey', '==', myProfileUUID),
          where('fromPubKey', '==', myProfileUUID),
        ),
        orderBy('timestamp'),
      );

      unsubscribeMessagesRef.current = onSnapshot(
        combinedMessageQuery,
        snapshot => {
          if (!snapshot?.docChanges()?.length) return;

          const newMessages = [];
          const newUniqueIds = new Map();

          snapshot.docChanges().forEach(change => {
            if (change.type !== 'added') return;

            const newMessage = change.doc.data();
            const isReceived = newMessage.toPubKey === myProfileUUID;
            console.log(
              `${isReceived ? 'received' : 'sent'} a new message`,
              newMessage,
            );

            if (typeof newMessage.message === 'string') {
              const sendersPubkey = isReceived
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

              if (parsedMessage?.senderProfileSnapshot && isReceived) {
                newUniqueIds.set(
                  sendersPubkey,
                  parsedMessage.senderProfileSnapshot?.uniqueName,
                );
              }

              newMessages.push({
                ...newMessage,
                message: parsedMessage,
                sendersPubkey,
                isReceived,
              });
            } else {
              newMessages.push(newMessage);
            }
          });

          updateContactUniqueName(newUniqueIds);
          if (newMessages.length > 0) {
            queueSetCashedMessages({
              newMessagesList: newMessages,
              myPubKey: myProfileUUID,
            });
          }
        },
      );
    }

    handleListener();

    return () => {
      if (unsubscribeMessagesRef.current) {
        unsubscribeMessagesRef.current();
      }
    };
  }, [myProfileUUID, contactsPrivateKey, updateContactUniqueName]);

  useEffect(() => {
    if (!Object.keys(globalContactsInformation).length) return;
    if (!contactsPrivateKey) return;
    updatedCachedMessagesStateFunction();
  }, [
    Boolean(Object.keys(globalContactsInformation).length),
    contactsPrivateKey,
    updatedCachedMessagesStateFunction,
  ]);

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    if (unsubscribeMessagesRef.current) {
      unsubscribeMessagesRef.current();
      unsubscribeMessagesRef.current = null;
    }
    setContactsMessagses({});
  }, [authResetkey]);

  const addContact = useCallback(
    async contact => {
      try {
        const newContact = {
          name: contact.name || '',
          nameLower: contact.nameLower || '',
          bio: contact.bio,
          unlookedTransactions: 0,
          isLNURL: contact.isLNURL,
          uniqueName: contact.uniqueName || '',
          uuid: contact.uuid,
          isAdded: true,
          isFavorite: false,
          profileImage: contact.profileImage,
          receiveAddress: contact.receiveAddress,
          transactions: [],
          isParentContact: contact.isParentContact || false,
        };

        setGlobalContactsInformation(prev => {
          let currentDecoded;
          try {
            const decryptedData = decryptMessage(
              contactsPrivateKey,
              publicKey,
              prev.addedContacts,
            );
            currentDecoded = JSON.parse(decryptedData) ?? [];
          } catch {
            currentDecoded = decodedAddedContactsRef.current ?? [];
          }

          let newAddedContacts = structuredClone(currentDecoded);
          if (!Array.isArray(newAddedContacts)) {
            newAddedContacts = [];
          }
          const exists = newAddedContacts.some(c => c.uuid === newContact.uuid);

          if (exists) {
            newAddedContacts = newAddedContacts.map(c =>
              c.uuid === newContact.uuid
                ? {
                    ...c,
                    name: newContact.name,
                    nameLower: newContact.nameLower,
                    bio: newContact.bio,
                    unlookedTransactions: 0,
                    isAdded: true,
                    isParentContact:
                      newContact.isParentContact || c.isParentContact,
                  }
                : c,
            );
          } else {
            newAddedContacts.push(newContact);
          }

          const newEncrypted = encriptMessage(
            contactsPrivateKey,
            publicKey,
            JSON.stringify(newAddedContacts),
          );

          if (!newEncrypted) {
            console.error('Encryption failed, aborting add contact');
            return prev;
          }

          const nextState = {
            ...prev,
            myProfile: { ...prev.myProfile, didEditProfile: true },
            addedContacts: newEncrypted,
          };

          addDataToCollection(
            { contacts: nextState },
            'blitzWalletUsers',
            publicKey,
          );

          return nextState;
        });
      } catch (err) {
        console.log('Error adding contact', err);
      }
    },
    [contactsPrivateKey, publicKey],
  );

  const deleteContact = useCallback(
    async contact => {
      try {
        if (contact?.isParentContact) return;
        await deleteCachedMessages(contact.uuid);

        setGlobalContactsInformation(prev => {
          let currentDecoded;
          try {
            const decryptedData = decryptMessage(
              contactsPrivateKey,
              publicKey,
              prev.addedContacts,
            );
            currentDecoded = JSON.parse(decryptedData) ?? [];
          } catch {
            currentDecoded = decodedAddedContactsRef.current ?? [];
          }

          if (!Array.isArray(currentDecoded)) {
            currentDecoded = [];
          }
          const newAddedContacts = currentDecoded.filter(
            c => c.uuid !== contact.uuid,
          );

          const newEncrypted = encriptMessage(
            contactsPrivateKey,
            publicKey,
            JSON.stringify(newAddedContacts),
          );

          if (!newEncrypted) {
            console.error('Encryption failed, aborting delete contact');
            return prev;
          }

          const nextState = {
            ...prev,
            myProfile: { ...prev.myProfile },
            addedContacts: newEncrypted,
          };

          addDataToCollection(
            { contacts: nextState },
            'blitzWalletUsers',
            publicKey,
          );

          return nextState;
        });
      } catch (err) {
        console.log('Error deleting contact', err);
      }
    },
    [contactsPrivateKey, publicKey],
  );

  // Child-claim handoff: the pairing flow persisted the parent's username in
  // PENDING_PARENT_CONTACT_KEY; on first arrival home, resolve the parent's
  // profile and add them as a non-deletable contact. Idempotent by design —
  // addContact stamps an already-present parent as non-deletable instead of
  // duplicating. The key + ref resolve together: cleared only on a definitive
  // outcome (added / not-a-child / self), so a failed lookup retries on the
  // next didGetToHomepage flip (long-background return).
  useEffect(() => {
    if (!didGetToHomepage || addedParentContactRef.current) return;
    if (!publicKey || !globalContactsInformationRef.current?.myProfile) return;

    (async () => {
      const rid = await getLocalStorageItem(PENDING_PARENT_CONTACT_KEY);
      if (!rid) {
        addedParentContactRef.current = true;
        return;
      }

      const docs = await getSingleContact(rid);
      const parent = docs?.[0]?.contacts?.myProfile;
      if (!parent?.uuid) return;
      if (parent.uuid === publicKey) {
        await removeLocalStorageItem(PENDING_PARENT_CONTACT_KEY);
        addedParentContactRef.current = true;
        return;
      }

      await addContact({
        name: parent.name || '',
        nameLower: parent.nameLower || '',
        bio: parent.bio,
        isLNURL: false,
        uniqueName: parent.uniqueName || '',
        uuid: parent.uuid,
        receiveAddress: parent.receiveAddress,
        isParentContact: true,
      });
      await removeLocalStorageItem(PENDING_PARENT_CONTACT_KEY);
      addedParentContactRef.current = true;
    })();
  }, [didGetToHomepage, publicKey, addContact]);

  // ─── Derived values (messages context) ─────────────────────────────────────
  const giftCardsList = useMemo(() => {
    if (!contactsMessags) return [];
    const actualContacts = Object.keys(contactsMessags).filter(
      k => k !== 'lastMessageTimestamp',
    );
    if (actualContacts.length === 0) return [];

    const giftCards = [];
    for (const contact of actualContacts) {
      const messages = contactsMessags[contact]?.messages;
      if (!messages?.length) continue;
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
    try {
      return Object.keys(contactsMessags).some(contactUUID => {
        if (
          contactUUID === 'lastMessageTimestamp' ||
          contactUUID === myProfileUUID
        ) {
          return false;
        }
        const messages = contactsMessags[contactUUID]?.messages;
        return (
          messages?.some(
            message =>
              !message.message.wasSeen &&
              !message.message?.[PARENT_ACCOUNT_TRANSFER_MARKER],
          ) ?? false
        );
      });
    } catch (err) {
      return false;
    }
  }, [contactsMessags, myProfileUUID]);

  // ─── Split context values ───────────────────────────────────────────────────
  // Info context: changes when contacts/profile change
  const infoContextValue = useMemo(
    () => ({
      decodedAddedContacts,
      globalContactsInformation,
      toggleGlobalContactsInformation,
      getContactReceiveOption,
      deleteContact,
      addContact,
    }),
    [
      decodedAddedContacts,
      globalContactsInformation,
      toggleGlobalContactsInformation,
      getContactReceiveOption,
      deleteContact,
      addContact,
    ],
  );

  // Messages context: changes when messages change
  const messagesContextValue = useMemo(
    () => ({
      contactsMessags,
      updatedCachedMessagesStateFunction,
      giftCardsList,
      hasUnlookedTransactions,
    }),
    [
      contactsMessags,
      updatedCachedMessagesStateFunction,
      giftCardsList,
      hasUnlookedTransactions,
    ],
  );

  return (
    <GlobalContactsInfoContext.Provider value={infoContextValue}>
      <GlobalContactsMessagesContext.Provider value={messagesContextValue}>
        {children}
      </GlobalContactsMessagesContext.Provider>
    </GlobalContactsInfoContext.Provider>
  );
};

// ─── Consumer hooks ─────────────────────────────────────────────────────────
export const useGlobalContactsInfo = () => {
  return React.useContext(GlobalContactsInfoContext);
};

export const useGlobalContactsMessages = () => {
  return React.useContext(GlobalContactsMessagesContext);
};

/**
 * @deprecated Use useGlobalContactsInfo() + useGlobalContactsMessages() separately.
 * This combined hook preserves backwards compatibility but causes the same
 * re-render behaviour as before the split — prefer the granular hooks.
 */
export const useGlobalContacts = () => {
  const info = React.useContext(GlobalContactsInfoContext);
  const messages = React.useContext(GlobalContactsMessagesContext);
  return { ...info, ...messages };
};
