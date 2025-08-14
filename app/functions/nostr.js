import {nip19} from 'nostr-tools';

export function isValidNpub(npub) {
  try {
    const decoded = nip19.decode(npub);
    return decoded.type === 'npub';
  } catch (error) {
    console.log('error validating npub', error);
    return false;
  }
}

export function npubToHex(pubkey) {
  try {
    // settings.nip5.errors,
    if (!pubkey || typeof pubkey !== 'string') {
      throw new Error('settings.nip5.errors.invalidPubKey');
    }

    const cleanPubkey = pubkey.trim();

    if (cleanPubkey.startsWith('npub1')) {
      try {
        const decoded = nip19.decode(cleanPubkey);
        if (decoded.type === 'npub' && typeof decoded.data === 'string') {
          return {didWork: true, data: decoded.data};
        }
        throw new Error('settings.nip5.errors.invalidNpub');
      } catch (error) {
        throw new Error(`settings.nip5.errors.decodeNpubError`);
      }
    }

    const hexRegex = /^[0-9a-fA-F]{64}$/;
    if (hexRegex.test(cleanPubkey)) {
      return {didWork: true, data: cleanPubkey.toLowerCase()};
    }

    throw new Error('settings.nip5.errors.invlaidFormat');
  } catch (err) {
    return {didWork: false, error: err.message};
  }
}
