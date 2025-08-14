import {getSingleContact} from '../../../../../../db';
import {getCachedProfileImage} from '../../../../../functions/cachedImage';

export default async function getDeepLinkUser({deepLinkContent, userProfile}) {
  try {
    const deepLinkUser = deepLinkContent.split('u/')[1];

    const rawUser = await getSingleContact(deepLinkUser);
    console.log(rawUser);
    if (rawUser.length === 0 || !rawUser)
      return new Promise(resolve =>
        resolve({
          didWork: false,
          reason: 'errormessages.noUserFoundDeeplinkError',
        }),
      );

    const user = rawUser[0];

    const newContact = {
      name: user.contacts.myProfile.name,
      uuid: user.contacts.myProfile.uuid,
      uniqueName: user.contacts.myProfile.uniqueName,
      // receiveAddress: user.contacts.myProfile.receiveAddress,
      isFavorite: false,
      transactions: [],
      unlookedTransactions: 0,
      isAdded: false,
    };

    if (userProfile.uuid === newContact.uuid) {
      return new Promise(resolve =>
        resolve({
          didWork: false,
          reason: 'errormessages.cannotAddSelfError',
        }),
      );
    }
    // look to see if new added user has a profile iamge saved
    await getCachedProfileImage(newContact.uuid);

    return new Promise(resolve =>
      resolve(resolve({didWork: true, reason: '', data: newContact})),
    );
  } catch (err) {
    console.log(err);
    return new Promise(resolve =>
      resolve({didWork: false, reason: 'errormessages.fullDeeplinkError'}),
    );
  }
}
