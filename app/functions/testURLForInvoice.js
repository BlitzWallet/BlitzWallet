import {convertMerchantQRToLightningAddress} from './sendBitcoin/getMerchantAddress';
export default function testURLForInvoice(data) {
  try {
    const websiteURL = new URL(data);

    const match = websiteURL.search?.toLowerCase()?.match(/lnurl1[0-9a-z]+/i);

    if (match) {
      console.log('LNURL invoice:', match[0]);
      return match[0];
    }

    //test for moneybadger invoice in web url
    const moneyBadgerMatch = convertMerchantQRToLightningAddress({
      qrContent: data,
      network: process.env.BOLTZ_ENVIRONEMNT,
    });

    if (moneyBadgerMatch) {
      return moneyBadgerMatch;
    }

    return false;
  } catch (err) {
    console.log('test url for invoice error', err);
    return false;
  }
}
