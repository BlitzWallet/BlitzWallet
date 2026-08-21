// Web shim for react-native-vision-camera: live camera preview via getUserMedia
// rendered as a raw <video> element, with a jsqr decode loop that drives the
// barcode-scanner stub's output handle (see its __isBarcodeOutput marker).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

const hasWebcam =
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

const BACK_DEVICE = hasWebcam ? { deviceId: 'back', position: 'back' } : null;

async function probeCamera() {
  if (!hasWebcam) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (err) {
    return false;
  }
}

export function useCameraPermission() {
  const [hasPermission, setHasPermission] = useState(false);

  // Resolves instantly without a prompt when the user already granted access.
  const requestPermission = useCallback(async () => {
    const granted = await probeCamera();
    setHasPermission(granted);
    return granted;
  }, []);

  return { hasPermission, requestPermission };
}

export async function requestCameraPermission() {
  return (await probeCamera()) ? 'granted' : 'denied';
}

export function useCameraDevice() {
  return BACK_DEVICE;
}
export function useCameraDevices() {
  return BACK_DEVICE ? [BACK_DEVICE] : [];
}

export function Camera({
  device,
  isActive = true,
  outputs = [],
  torchMode,
  style,
}) {
  const videoRef = useRef(null);
  const outputsRef = useRef(outputs);
  outputsRef.current = outputs;

  // Consumers pass StyleSheet.absoluteFill; drop its position offsets so the
  // video stays in normal flow and stretches to fill its parent instead.
  const { position, top, left, right, bottom, ...flowStyle } = style || {};

  useEffect(() => {
    if (!isActive || !hasWebcam) return undefined;

    let stopped = false;
    let stream;
    let rafId;

    function stopStream() {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = undefined;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        const video = videoRef.current;
        if (!video) return;
        if (stopped) {
          stopStream();
          return;
        }
        video.srcObject = stream;
        await video.play();

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let lastDecode = 0;

        const scanFrame = timestamp => {
          if (stopped) return;
          // Decode at ~10fps; jsqr on every rAF frame would burn CPU.
          if (
            timestamp - lastDecode > 100 &&
            video.readyState >= 2 &&
            video.videoWidth > 0
          ) {
            lastDecode = timestamp;
            const scale = Math.min(1, 480 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(frame.data, frame.width, frame.height);
            if (code?.data) {
              outputsRef.current.forEach(output => {
                if (output?.__isBarcodeOutput) {
                  output.onBarcodeScanned([
                    { format: 'qr-code', rawValue: code.data },
                  ]);
                }
              });
            }
          }
          rafId = requestAnimationFrame(scanFrame);
        };
        rafId = requestAnimationFrame(scanFrame);
      } catch (err) {
        outputsRef.current.forEach(output => {
          if (output?.__isBarcodeOutput) output.onError?.(err);
        });
      }
    }

    start();
    return () => {
      stopped = true;
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      stopStream();
    };
  }, [isActive]);

  const isTorchOn = torchMode === 'on';
  useEffect(() => {
    videoRef.current?.srcObject?.getTracks().forEach(async track => {
      try {
        await track.applyConstraints({ advanced: [{ torch: isTorchOn }] });
      } catch (err) {
        // Torch unsupported in this browser — flash button is a silent no-op.
      }
    });
  }, [isTorchOn]);

  if (!hasWebcam) return null;

  return React.createElement('video', {
    ref: videoRef,
    autoPlay: true,
    muted: true,
    playsInline: true,
    style: {
      objectFit: 'cover',
      width: '100%',
      height: '100%',
      position: 'absolute',
      ...flowStyle,
    },
  });
}

export default Camera;
