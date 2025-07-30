import * as Notifications from 'expo-notifications';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Pushes an instant local notification
 * @param {string} message - The notification message to display
 * @param {string} title - Optional title for the notification (defaults to "Notification")
 * @returns {Promise<string>} - Returns the notification identifier
 */
export const pushInstantNotification = async (message, title = '') => {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: message,
        sound: 'default',
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
