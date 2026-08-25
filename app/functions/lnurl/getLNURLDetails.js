import { decodeLNURL } from './bench32Formmater';
import { isHTTPS } from './ishttps';

// Local part matches the app's own address validation (constants EMAIL_REGEX)
// minus '%': percent sequences would survive into the URL path, where '%2f'
// re-opens the traversal this validation exists to close. '%' is not valid in
// a LUD-16 address anyway. The domain must end in a real TLD, which rejects
// bare hostnames ('localhost') and every IPv4 encoding, including the
// trailing-dot, hex and decimal forms.
export const LIGHTNING_ADDRESS_REGEX =
  /^([a-zA-Z0-9._+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;

export default async function getLNURLDetails(lnurl) {
  try {
    let fetchString = '';
    const decodedLNURL = decodeLNURL(lnurl);
    if (decodedLNURL) {
      if (!isHTTPS(decodedLNURL)) throw new Error('LNURL must use HTTPS');
      fetchString = decodedLNURL;
    } else {
      const match = lnurl.match(LIGHTNING_ADDRESS_REGEX);
      if (!match) throw new Error('Invalid lightning address');
      const [, username, domain] = match;
      fetchString = `https://${domain}/.well-known/lnurlp/${username}`;
    }

    const response = await fetch(fetchString);
    const data = await response.json();

    return data;
  } catch (err) {
    console.log('error getting lnurl details', err);
    return false;
  }
}
