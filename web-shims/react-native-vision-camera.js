// Web shim for react-native-vision-camera: no camera in v1 (paste-only QR).
// getUserMedia + BarcodeDetector is a v1.1 add (cameraModal.web.js).
import React from 'react';

export function Camera() {
  return null;
}
export function useCameraDevice() {
  return null;
}
export function useCameraDevices() {
  return [];
}
export function useCameraPermission() {
  return { hasPermission: false, requestPermission: async () => false };
}
export async function requestCameraPermission() {
  return 'denied';
}

export default { Camera, useCameraDevice, useCameraDevices, useCameraPermission };
