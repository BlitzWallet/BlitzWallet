import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';
import { useKeysContext } from '../../../../../../context-store/keys';
import {
  decryptMessage,
  encriptMessage,
} from '../../../../../functions/messaging/encodingAndDecodingMessages';
import { crashlyticsLogReport } from '../../../../../functions/crashlyticsLogs';

/**
 * Returns a stable `navigateToExpandedContact(contact)` callback.
 * If the contact has not yet been marked as added, it will be marked
 * before navigation — consistent behaviour across ContactsPage and ExpandedTx.
 */
export function useNavigateToContact() {
  const navigate = useNavigation();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const {
    decodedAddedContacts,
    toggleGlobalContactsInformation,
  } = useGlobalContactsInfo();

  const navigateToExpandedContact = useCallback(
    async (contact, fromPage) => {
      try {
        crashlyticsLogReport('Navigating to expanded contact');

        if (!contact.isAdded) {
          // Read-modify-write the LATEST blob inside the updater so back-to-back
          // taps (or a racing add/delete) can't clobber each other from a stale
          // render snapshot. Abort the write if encryption fails rather than
          // persisting `addedContacts: undefined`.
          toggleGlobalContactsInformation(prev => {
            let currentDecoded;
            try {
              currentDecoded =
                JSON.parse(
                  decryptMessage(contactsPrivateKey, publicKey, prev.addedContacts),
                ) ?? [];
            } catch {
              currentDecoded = decodedAddedContacts ?? [];
            }
            if (!Array.isArray(currentDecoded)) currentDecoded = [];

            const newAddedContacts = currentDecoded.map(obj =>
              obj.uuid === contact.uuid ? { ...obj, isAdded: true } : obj,
            );

            const addedContacts = encriptMessage(
              contactsPrivateKey,
              publicKey,
              JSON.stringify(newAddedContacts),
            );
            if (!addedContacts) return null;

            return {
              myProfile: { ...prev.myProfile },
              addedContacts,
            };
          }, true);
        }

        requestAnimationFrame(() => {
          if (fromPage === 'expandedTx') {
            navigate.replace('ExpandedContactsPage', { uuid: contact.uuid });
          } else {
            navigate.navigate('ExpandedContactsPage', { uuid: contact.uuid });
          }
        });
      } catch (err) {
        console.log('Error navigating to expanded contact', err);
        requestAnimationFrame(() => {
          if (fromPage === 'expandedTx') {
            navigate.replace('ExpandedContactsPage', { uuid: contact.uuid });
          } else {
            navigate.navigate('ExpandedContactsPage', { uuid: contact.uuid });
          }
        });
      }
    },
    [
      decodedAddedContacts,
      toggleGlobalContactsInformation,
      contactsPrivateKey,
      publicKey,
      navigate,
    ],
  );

  return navigateToExpandedContact;
}
