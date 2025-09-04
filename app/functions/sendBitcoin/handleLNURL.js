import {formatLightningAddress} from '../lnurl';
import {decodeLNURL} from '../lnurl/bench32Formmater';

export default async function hanndleLNURLAddress(address) {
  let btcAddress = '';
  const decodedLNURL = decodeLNURL(address);

  if (!decodedLNURL) {
    btcAddress = address;
  } else {
    const parsedUrl = new URL(decodedLNURL);

    const isAuthRequset =
      parsedUrl.searchParams.get('k1') && parsedUrl.searchParams.get('tag');

    if (isAuthRequset) {
      btcAddress = address;
    } else {
      const response = await fetch(decodedLNURL);
      const data = await response.json();

      if (data.status === 'ERROR') {
        throw new Error('Unable to get lnurl metadata');
      }
      if (data.tag === 'withdrawRequest') {
        btcAddress = address;
      } else {
        const lightningAddress = formatLightningAddress(decodedLNURL);
        btcAddress = lightningAddress;
      }
    }
  }
  return btcAddress;
}
