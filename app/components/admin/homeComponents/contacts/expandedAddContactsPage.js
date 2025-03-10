import ExpandedContactsPage from './expandedContactPage';
import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import EditMyProfilePage from './editMyProfilePage';

export default function ExpandedAddContactsPage(props) {
  const {decodedAddedContacts, globalContactsInformation} = useGlobalContacts();

  const newContact = props.route.params?.newContact;

  const selectedContact = decodedAddedContacts.filter(
    contact =>
      (contact.uuid === newContact?.uuid && contact.isAdded) ||
      (contact.isLNURL &&
        contact.receiveAddress.toLowerCase() ===
          newContact.receiveAddress?.toLowerCase()),
  );

  const isSelf =
    newContact.uniqueName?.toLowerCase() ==
    globalContactsInformation?.myProfile?.uniqueName?.toLowerCase();

  return (
    <>
      {selectedContact.length > 0 ? (
        <ExpandedContactsPage uuid={selectedContact[0].uuid} />
      ) : (
        <EditMyProfilePage
          pageType={isSelf ? 'myProfile' : 'addedContact'}
          selectedAddedContact={newContact}
          fromInitialAdd={!isSelf}
        />
      )}
    </>
  );
}
