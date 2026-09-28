// Web shim for @react-native-firebase/messaging: push notifications are out
// of core v1 scope. No-op APNs/FCM registration so the notification provider
// mounts harmlessly. (Web Push via a service worker is a later add.)
export function getMessaging() {
  return {};
}
export async function getAPNSToken() {
  return null;
}
export async function getToken() {
  return null;
}
export async function isDeviceRegisteredForRemoteMessages() {
  return false;
}
export async function registerDeviceForRemoteMessages() {}
export function setBackgroundMessageHandler() {}
export function onMessage() {
  return () => {};
}
export async function requestPermission() {
  return 0;
}
export async function getInitialNotification() {
  return null;
}
export function onNotificationOpenedApp() {
  return () => {};
}

export default {
  getMessaging,
  getAPNSToken,
  getToken,
  isDeviceRegisteredForRemoteMessages,
  registerDeviceForRemoteMessages,
  setBackgroundMessageHandler,
  onMessage,
  requestPermission,
  getInitialNotification,
  onNotificationOpenedApp,
};
