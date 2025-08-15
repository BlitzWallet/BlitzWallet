import {createHash, randomBytes} from 'react-native-quick-crypto';
export default function customUUID() {
  try {
    const preimage = randomBytes(32);
    return createHash('sha256')
      .update(preimage)
      .update(JSON.stringify(new Date().getTime()))
      .digest()
      .toString('hex')
      .slice(0, 16);
  } catch (err) {
    console.log(err);
    return false;
  }
}
