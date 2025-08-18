import {setStringAsync} from 'expo-clipboard';

export default async function copyToClipboard(
  data,
  showToast,
  page,
  customText,
) {
  try {
    await setStringAsync(data);
    if (page === 'ChatGPT') return;
    showToast({
      type: 'clipboard',
      title: 'toastmessages.confirmCopy',
      duration: 2000,
    });
  } catch (err) {
    if (page === 'ChatGPT') return;
    showToast({
      type: 'clipboard',
      title: 'toastmessages.failedCopy',
      duration: 2000,
    });
  }
}
