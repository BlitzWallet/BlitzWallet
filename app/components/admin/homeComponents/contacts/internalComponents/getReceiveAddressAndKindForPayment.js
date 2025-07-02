import {getDataFromCollection} from '../../../../../../db';
import {formatBip21SparkAddress} from '../../../../../functions/spark/handleBip21SparkAddress';

export default async function getReceiveAddressForContactPayment(
  sendingAmountSat,
  selectedContact,
) {
  try {
    let receiveAddress;

    const retrivedContact = await getDataFromCollection(
      'blitzWalletUsers',
      selectedContact.uuid,
    );
    console.log('Retrived selected contact', retrivedContact);
    if (!retrivedContact)
      throw new Error('Error retrieving contact information');

    if (retrivedContact?.contacts?.myProfile?.sparkAddress) {
      receiveAddress = formatBip21SparkAddress({
        address: retrivedContact?.contacts?.myProfile?.sparkAddress,
        amountSat: sendingAmountSat,
        message: `Paying ${selectedContact.name || selectedContact.uniqueName}`,
      });
    } else
      throw new Error(
        'Contact has not updated thier wallet yet. Please ask them to update their wallet to send this.',
      );

    return {didWork: true, receiveAddress, retrivedContact};
  } catch (err) {
    console.log('error getting receive address for contact payment');
    return {didWork: false, error: err.message};
  }
}
