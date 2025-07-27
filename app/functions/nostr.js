import {nip19} from 'nostr-tools';

export default function isValidNpub(npub) {
  try {
    const decoded = nip19.decode(npub);
    return decoded.type === 'npub';
  } catch (error) {
    console.log('error validating npub', error);
    return false;
  }
}
