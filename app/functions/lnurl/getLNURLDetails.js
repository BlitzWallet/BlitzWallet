import {decodeLNURL} from './bench32Formmater';

export default async function getLNURLDetails(lnurl) {
  try {
    let fetchString = '';
    const decodedLNURL = decodeLNURL(lnurl);
    if (decodedLNURL) fetchString = decodedLNURL;
    else {
      const [username, domain] = lnurl.split('@');
      console.log(username, domain);
      fetchString = `https://${domain}/.well-known/lnurlp/${username}`;
    }

    console.log(fetchString);
    const response = await fetch(fetchString);
    const data = await response.json();

    return data;
  } catch (err) {
    console.log('error getting lnurl details', err);
    return false;
  }
}
