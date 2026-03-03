import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useGlobalContacts } from '../../../../../../context-store/globalContacts';
import { useKeysContext } from '../../../../../../context-store/keys';
import { encriptMessage } from '../../../../../functions/messaging/encodingAndDecodingMessages';
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
    globalContactsInformation,
    toggleGlobalContactsInformation,
  } = useGlobalContacts();

  const navigateToExpandedContact = useCallback(
    async (contact, fromPage) => {
      try {
        crashlyticsLogReport('Navigating to expanded contact');

        if (!contact.isAdded) {
          const newAddedContacts = [...decodedAddedContacts];
          const index = newAddedContacts.findIndex(
            obj => obj.uuid === contact.uuid,
          );

          if (index !== -1) {
            newAddedContacts[index] = {
              ...newAddedContacts[index],
              isAdded: true,
            };
          }

          toggleGlobalContactsInformation(
            {
              myProfile: { ...globalContactsInformation.myProfile },
              addedContacts: encriptMessage(
                contactsPrivateKey,
                publicKey,
                JSON.stringify(newAddedContacts),
              ),
            },
            true,
          );
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
      globalContactsInformation,
      toggleGlobalContactsInformation,
      contactsPrivateKey,
      publicKey,
      navigate,
    ],
  );

  return navigateToExpandedContact;
}
