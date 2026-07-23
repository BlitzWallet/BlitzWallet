// Web shim for @react-native-firebase/storage -> firebase/storage.
// RNFB's putFile(ref, localUri) has no web equivalent; bridge it to
// uploadBytes by fetching the URI into a Blob. (Profile images are deferred
// scope; this keeps the module importable and functional if reached.)
import './firebase-app';
import { uploadBytes } from 'firebase/storage';
export * from 'firebase/storage';

export async function putFile(storageRef, localUriOrUri) {
  const uri = typeof localUriOrUri === 'string' ? localUriOrUri : localUriOrUri?.uri;
  const res = await fetch(uri);
  const blob = await res.blob();
  return uploadBytes(storageRef, blob);
}
