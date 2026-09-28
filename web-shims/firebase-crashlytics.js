// Web shim for @react-native-firebase/crashlytics: no Crashlytics on web.
// Route to console so crashlyticsLogs.js keeps working untouched.
export function getCrashlytics() {
  return {};
}
export function log(_c, ...args) {
  console.log('[crashlytics]', ...args);
}
export function recordError(_c, error) {
  console.error('[crashlytics]', error);
}
export async function setCrashlyticsCollectionEnabled() {}
export function setAttribute() {}

export default {
  getCrashlytics,
  log,
  recordError,
  setCrashlyticsCollectionEnabled,
  setAttribute,
};
