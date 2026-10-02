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

    // Accept nostr: URIs and uppercase bech32 (valid per BIP-173).
    const cleanPubkey = pubkey.trim().replace(/^nostr:/i, '');
    const lowerPubkey = cleanPubkey.toLowerCase();

    if (
      lowerPubkey.startsWith('npub1') ||
      lowerPubkey.startsWith('nprofile1')
    ) {
      try {
        const decoded = nip19.decode(lowerPubkey);
        if (decoded.type === 'npub' && typeof decoded.data === 'string') {
          return {didWork: true, data: decoded.data};
        }
        if (decoded.type === 'nprofile' && decoded.data?.pubkey) {
          return {didWork: true, data: decoded.data.pubkey};
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

    throw new Error('settings.nip5.errors.invalidFormat');
  } catch (err) {
    return {didWork: false, error: err.message};
  }
}
