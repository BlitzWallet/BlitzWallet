import * as Clipboard from 'expo-clipboard';

export default async function copyToClipboard(
  data,
  showToast,
  page,
  customText,
) {
  try {
    await Clipboard.setStringAsync(data);
    if (page === 'ChatGPT') return;
    showToast({
      type: 'clipboard',
      title: 'Copied to clipboard',
      duration: 2000,
    });
  } catch (err) {
    if (page === 'ChatGPT') return;
    showToast({
      type: 'clipboard',
      title: 'Failed to copy',
      duration: 2000,
    });
  }
}
