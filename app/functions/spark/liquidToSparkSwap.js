// import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';
import {breezLiquidLNAddressPaymentWrapper} from '../breezLiquid';
import i18next from 'i18next';
import getLNURLDetails from '../lnurl/getLNURLDetails';
import {InputTypes} from 'bitcoin-address-parser';

export default async function liquidToSparkSwap(contactUsername) {
  try {
    let maxRunCount = 5;
    let runCount = 0;
    let parsedData = null;
    while (maxRunCount > runCount && !parsedData) {
      runCount += 1;
      try {
        const didGetData = await getLNURLDetails(
          `${contactUsername}@blitzwalletapp.com`,
        );
        if (!didGetData) throw new Error('Unable to get lnurl data');
        const parsed = {
          type: InputTypes.LNURL_PAY,
          data: {
            ...didGetData,
            metadataStr: didGetData.metadata, //added for breeze
            domain: 'blitzwalletapp.com', //added for breeze
          },
        };
        parsedData = parsed;
        break;
      } catch (err) {
        console.log('Error parsing LNURL, assuming its a backend issue');
        await new Promise(res => setTimeout(res, 1000));
      }
    }

    if (!parsedData) throw new Error('errormessages.invoiceRetrivalError');

    const paymentResponse = await breezLiquidLNAddressPaymentWrapper({
      description: i18next.t('swapMessages.liquid'),
      paymentInfo: parsedData.data,
      shouldDrain: true,
    });

    if (!paymentResponse.didWork) throw new Error(paymentResponse.error);

    return {didWork: true};
  } catch (err) {
    console.log(err);

    return {didWork: false, error: err.message};
  }
}
