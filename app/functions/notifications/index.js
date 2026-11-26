import {
  scheduleNotificationAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  // Configure notification behavior
  setNotificationHandler({
    handleNotification: async notification => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: !notification.request.content.data?.nwcSilent,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Pushes an instant local notification
 * @param {string} message - The notification message to display
 * @param {string} title - Optional title for the notification (defaults to "Notification")
 * @param {object} options - Optional display options
 * @param {string} options.identifier - Reuse to replace an existing notification in place
 * @param {boolean} options.silent - Post without sound
 * @returns {Promise<string>} - Returns the notification identifier
 */
export const pushInstantNotification = async (
  message,
  title = '',
  options = {},
) => {
  try {
    const { identifier, silent = false } = options;
    const notificationId = await scheduleNotificationAsync({
      identifier,
      content: {
        title: title,
        body: message,
        // Android plays the default sound when `sound` is omitted.
        sound: silent ? false : 'default',
        ...(silent ? { data: { nwcSilent: true } } : {}),
      },
      trigger: null, // null trigger means immediate notification
    });

    console.log('Notification sent with ID:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};
