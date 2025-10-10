import { randomBytes } from 'react-native-quick-crypto';

export default function customUUID() {
  try {
    return randomBytes(32).toString('hex').slice(0, 16);
  } catch (err) {
    console.log(err);
    return false;
  }
}
