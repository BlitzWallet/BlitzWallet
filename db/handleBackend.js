import {getFunctions} from '@react-native-firebase/functions';
import {
  decryptMessage,
  encriptMessage,
} from '../app/functions/messaging/encodingAndDecodingMessages';

export default async function fetchBackend(
  method,
  data,
  privateKey,
  publicKey,
) {
  try {
    const message = encodeRequest(privateKey, data);

    if (!message) throw new Error('Unable to encode request');
    const responseData = {
      em: message,
      publicKey,
    };
    console.log('function call data', responseData);
    const response = await getFunctions().httpsCallable(method)(responseData);

    const dm = decodeRequest(privateKey, response.data);
    console.log('decoded response', dm);

    return dm;
  } catch (err) {
    console.log('backend fetch wrapper error', err);
    return false;
  }
}
function encodeRequest(privateKey, data) {
  try {
    const encription = encriptMessage(
      privateKey,
      process.env.BACKEND_PUB_KEY,
      JSON.stringify(data),
    );

    return encription;
  } catch (err) {
    console.log('backend fetch wrapper error', err);
    return false;
  }
}
function decodeRequest(privateKey, data) {
  try {
    const message = decryptMessage(
      privateKey,
      process.env.BACKEND_PUB_KEY,
      data,
    );
    const parsedMessage = JSON.parse(message);

    return parsedMessage;
  } catch (err) {
    console.log('backend fetch wrapper error', err);
    return false;
  }
}
