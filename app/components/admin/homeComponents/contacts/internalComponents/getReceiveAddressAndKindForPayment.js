import { getDataFromCollection } from '../../../../../../db';
import { getBolt11InvoiceForContact } from '../../../../../functions/contacts';
import { formatBip21Address } from '../../../../../functions/spark/handleBip21SparkAddress';

export default async function getReceiveAddressAndContactForContactsPayment({
  sendingAmountSat,
  selectedContact,
  myProfileMessage = '',
  payingContactMessage = '',
  onlyGetContact = false,
}) {
  try {
    let receiveAddress;
    let retrivedContact;
    let message = '';

    if (selectedContact.isLNURL) {
      receiveAddress = selectedContact.receiveAddress;
      retrivedContact = selectedContact;
    } else {
      retrivedContact = await getDataFromCollection(
        'blitzWalletUsers',
        selectedContact.uuid,
      );

      if (!retrivedContact) throw new Error('errormessages.fullDeeplinkError');

      if (onlyGetContact)
        return { didWork: true, receiveAddress: '', retrivedContact };

      if (retrivedContact?.contacts?.myProfile?.sparkAddress) {
        if (payingContactMessage?.usingTranslation) {
          message = retrivedContact.isUsingNewNotifications
            ? JSON.stringify({
                name: payingContactMessage.name,
                translation: 'contacts.sendAndRequestPage.contactMessage',
              })
            : `${payingContactMessage.name} paid you`;
        } else {
          message = payingContactMessage;
        }

        receiveAddress = `${retrivedContact?.contacts?.myProfile?.uniqueName}@blitzwalletapp.com`;

        // const lnurlInvoice = await getBolt11InvoiceForContact(
        //   retrivedContact?.contacts?.myProfile?.uniqueName,
        //   sendingAmountSat,
        //   message,
        // );
        // if (lnurlInvoice) {
        //   receiveAddress = lnurlInvoice;
        // } else {
        //   receiveAddress = formatBip21Address({
        //     address: retrivedContact?.contacts?.myProfile?.sparkAddress,
        //     amountSat: sendingAmountSat,
        //     message: myProfileMessage,
        //     prefix: 'spark',
        //   });
        // }
      } else throw new Error('errormessages.legacyContactError');
    }

    return {
      didWork: true,
      receiveAddress,
      retrivedContact,
      formattedPayingContactMessage: message,
    };
  } catch (err) {
    console.log('error getting receive address for contact payment');
    return { didWork: false, error: err.message };
  }
}
