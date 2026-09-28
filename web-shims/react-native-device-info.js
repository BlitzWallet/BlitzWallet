// Web shim for react-native-device-info: static/browser-derived values.
import appJson from '../app.json';

export function getVersion() {
  return appJson.version;
}
export function getBuildNumber() {
  return '0';
}
export function getModel() {
  return 'Web';
}
export function getSystemVersion() {
  return typeof navigator !== 'undefined' ? navigator.userAgent : 'web';
}
export function isEmulatorSync() {
  return false;
}
export async function isEmulator() {
  return false;
}
export function getUniqueIdSync() {
  return 'web';
}

const DeviceInfo = {
  getVersion,
  getBuildNumber,
  getModel,
  getSystemVersion,
  isEmulatorSync,
  isEmulator,
  getUniqueIdSync,
};
export default DeviceInfo;
