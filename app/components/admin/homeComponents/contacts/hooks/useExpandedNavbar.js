import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useGlobalContacts } from '../../../../../../context-store/globalContacts';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import {
  decryptMessage,
  encriptMessage,
} from '../../../../../functions/messaging/encodingAndDecodingMessages';
import { useKeysContext } from '../../../../../../context-store/keys';

/**
 * Custom hook for managing profile image operations
 * Handles adding, uploading, and deleting profile images for contacts
 */
export function useExpandedNavbar() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { isConnectedToTheInternet } = useAppStatus();
  const { globalContactsInformation, toggleGlobalContactsInformation } =
    useGlobalContacts();

  /**
   * toggle whether a contact is a favorite
   * @param {object} selectedContact - The contact object (only needed if not editing own profile)
   */
  const handleFavortie = async ({ selectedContact }) => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    if (!selectedContact) return;
    toggleGlobalContactsInformation(
      {
        myProfile: { ...globalContactsInformation.myProfile },
        addedContacts: encriptMessage(
          contactsPrivateKey,
          publicKey,
          JSON.stringify(
            [
              ...JSON.parse(
                decryptMessage(
                  contactsPrivateKey,
                  publicKey,
                  globalContactsInformation.addedContacts,
                ),
              ),
            ].map(savedContact => {
              if (savedContact.uuid === selectedContact.uuid) {
                return {
                  ...savedContact,
                  isFavorite: !savedContact.isFavorite,
                };
              } else return savedContact;
            }),
          ),
        ),
      },
      true,
    );
  };

  /**
   * navigate to settings page
   * @param {object} params - Upload parameters
   * @param {object} selectedContact - The contact object (only needed if not editing own profile)
   */
  const handleSettings = ({ selectedContact }) => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    if (!selectedContact) return;
    navigate.navigate('EditMyProfilePage', {
      pageType: 'addedContact',
      selectedAddedContact: selectedContact,
    });
  };

  return {
    handleFavortie,
    handleSettings,
  };
}
