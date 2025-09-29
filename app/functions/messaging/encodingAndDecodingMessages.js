import {Buffer} from 'buffer';
import {getSharedSecret} from '@noble/secp256k1';
import {createCipheriv, createDecipheriv} from 'react-native-quick-crypto';

function encriptMessage(privkey, pubkey, text) {
  //   const encripted = await nostr.nip04.encrypt(privkey, pubkey, text);
  //   console.log(encripted);
  //   return new Promise(resolve => {
  //     resolve(encripted);
  //   });
  try {
    // return nip04.encrypt(priv, pubkey, content);

    // return;
    const shardPoint = getSharedSecret(privkey, '02' + pubkey);
    const sharedX = shardPoint.slice(1, 33);

    const iv = Buffer.from(
      Array.from({length: 16}, () => Math.floor(Math.random() * 256)),
    );

    const cipher = createCipheriv('aes-256-cbc', Buffer.from(sharedX), iv);

    let encriptMessage = cipher.update(text, 'utf8', 'base64');
    encriptMessage += cipher.final('base64');
    encriptMessage +=
      '?iv=' + btoa(String.fromCharCode.apply(null, new Uint8Array(iv.buffer)));
    return encriptMessage;
  } catch (err) {
    console.log(err, 'ENCRIPT ERROR');
  }
}
function decryptMessage(privkey, pubkey, encryptedText) {
  try {
    const shardPoint = getSharedSecret(privkey, '02' + pubkey);
    const sharedX = shardPoint.slice(1, 33);

    // Extract IV from the encrypted message
    const ivStr = encryptedText.split('?iv=')[1];
    const iv = new Uint8Array(Buffer.from(atob(ivStr), 'binary'));

    // Remove IV from the encrypted message
    const encryptedData = encryptedText.split('?iv=')[0];

    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(sharedX), iv);

    let decryptedMessage = decipher.update(encryptedData, 'base64', 'utf8');
    decryptedMessage += decipher.final('utf8');
    return decryptedMessage;
  } catch (err) {
    console.log(err, 'DECRYPT ERROR');
    return null;
  }
}

export {encriptMessage, decryptMessage};
