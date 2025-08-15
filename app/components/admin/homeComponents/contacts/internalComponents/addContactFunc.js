// import {getPublicKey} from 'nostr-tools';
// import {
//   decryptMessage,
//   encriptMessage,
// } from '../../../../../functions/messaging/encodingAndDecodingMessages';

// export default function addContact(
//   newContact,
//   globalContactsInformation,
//   toggleGlobalContactsInformation,
//   navigate,
//   navigation,
//   contactsPrivateKey,
//   isFromExpandedPage,
// ) {
//   try {
//     const publicKey = getPublicKey(contactsPrivateKey);
//     let savedContacts =
//       typeof globalContactsInformation.addedContacts === 'string'
//         ? [
//             ...JSON.parse(
//               decryptMessage(
//                 contactsPrivateKey,
//                 publicKey,
//                 globalContactsInformation.addedContacts,
//               ),
//             ),
//           ]
//         : [];

//     if (globalContactsInformation.myProfile.uuid === newContact.uuid) {
//       navigate.navigate('ErrorScreen', {
//         errorMessage: 'Cannot add yourself',
//       });
//       return;
//     } else if (
//       savedContacts.filter(
//         savedContact =>
//           savedContact.uuid === newContact.uuid ||
//           newContact.uuid === globalContactsInformation.myProfile.uuid,
//       ).length > 0
//     ) {
//       navigate.navigate('ErrorScreen', {
//         errorMessage: 'Contact already added',
//       });
//       return;
//     }

//     savedContacts.push(newContact);

//     toggleGlobalContactsInformation(
//       {
//         myProfile: {
//           ...globalContactsInformation.myProfile,
//         },
//         addedContacts: encriptMessage(
//           contactsPrivateKey,
//           publicKey,
//           JSON.stringify(savedContacts),
//         ),
//       },
//       true,
//     );
//   } catch (err) {
//     console.log(err);

//     navigate.navigate('ErrorScreen', {errorMessage: 'Error adding contact'});
//   }
// }
