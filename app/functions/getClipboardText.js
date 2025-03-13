import * as Clipboard from 'expo-clipboard';
export default async function getClipboardText() {
  try {
    const data = await Clipboard.getStringAsync();
    if (!data || !data.trim().length) throw new Error('No data in clipboard');

    return {didWork: true, data};
  } catch (err) {
    return {didWork: false, reason: err.message};
  }
}
