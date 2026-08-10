import { randomBytes } from 'react-native-quick-crypto';

export default function customUUID() {
  // Must never fail open to a falsy id: a falsy id collides every caller on the
  // same pending-request slot and its response is dropped. Throw instead.
  return randomBytes(32).toString('hex').slice(0, 16);
}
