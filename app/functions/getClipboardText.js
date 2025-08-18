import {getStringAsync} from 'expo-clipboard';

export default async function getClipboardText() {
  try {
    const data = await getStringAsync();
    if (!data || !data.trim().length)
      throw new Error('errormessages.clipboardContentError');

    return {didWork: true, data};
  } catch (err) {
    return {didWork: false, reason: err.message};
  }
}
