// Web shim for react-native-vision-camera: live camera preview via getUserMedia
// rendered as a raw <video> element, with a decode loop that drives the
// barcode-scanner stub's output handle (see its __isBarcodeOutput marker).
// The loop prefers the browser's BarcodeDetector — on Android Chrome that is
// ML Kit, the same engine the native Android path uses — and falls back to
// jsqr where the API is missing (Safari, Firefox).
import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ActivityIndicator } from 'react-native';
import jsQR from 'jsqr';

const hasWebcam =
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

const BACK_DEVICE = hasWebcam ? { deviceId: 'back', position: 'back' } : null;

// Cap the ingested stream. Unconstrained, phones hand back a 1080p/4K texture
// and every decode pays a full-size GPU readback plus a scale in drawImage.
// Not 640x480: BOLT11 invoice QRs are version 15+ (~77 modules) and start
// losing decodes there. 'ideal' is a soft constraint, so this never rejects.
const VIDEO_CONSTRAINTS = {
  facingMode: 'environment',
  width: { ideal: 1280 },
  height: { ideal: 720 },
};

// undefined = not probed yet, null = unsupported or unusable.
let qrDetector;
function getQrDetector() {
  if (qrDetector !== undefined) return qrDetector;
  qrDetector = null;
  try {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      qrDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
    }
  } catch (err) {
    // Constructor rejects qr_code, or the API is a stub — jsqr covers it.
  }
  return qrDetector;
}

// Native knows the OS permission on first render; the web can only learn it by
// opening the camera. So 'unknown' counts as permitted: <Camera> mounts right
// away and its own getUserMedia doubles as the prompt, instead of a probe
// stream followed by a second one. A failure there flips screens to no-access.
let permissionStatus = hasWebcam ? 'unknown' : 'denied';
const listeners = new Set();
function setPermissionStatus(status) {
  permissionStatus = status;
  listeners.forEach(listener => listener());
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function probeCamera() {
  if (!hasWebcam) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: VIDEO_CONSTRAINTS,
    });
    stream.getTracks().forEach(track => track.stop());
    setPermissionStatus('granted');
    return true;
  } catch (err) {
    setPermissionStatus('denied');
    return false;
  }
}

export function useCameraPermission() {
  const status = useSyncExternalStore(subscribe, () => permissionStatus);
  return { hasPermission: status !== 'denied', requestPermission: probeCamera };
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
  const [isStreaming, setIsStreaming] = useState(false);
  const outputsRef = useRef(outputs);
  outputsRef.current = outputs;

  // Consumers pass StyleSheet.absoluteFill; drop its position offsets so the
  // video stays in normal flow and stretches to fill its parent instead.
  const { position, top, left, right, bottom, ...flowStyle } = style || {};

  useEffect(() => {
    if (!isActive || !hasWebcam) return undefined;

    let stopped = false;
    let stream;
    let cancelFrame = () => {};

    function stopStream() {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = undefined;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    async function start() {
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: VIDEO_CONSTRAINTS,
          });
        } catch (err) {
          setPermissionStatus('denied');
          throw err;
        }
        setPermissionStatus('granted');
        // getUserMedia() resolves asynchronously: the scanner may have
        // unmounted (stopped) or its video element may be gone while
        // permission was pending. Stop the fresh stream in either case —
        // returning early without stopping leaks an active camera track.
        const video = videoRef.current;
        if (!video || stopped) {
          stopStream();
          return;
        }
        video.srcObject = stream;
        await video.play();
        if (!stopped) setIsStreaming(true);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let lastDecode = 0;
        let frameId;

        // requestVideoFrameCallback fires once per *new* frame, so we never
        // re-decode a frame rAF already handed us. rAF is the Firefox path.
        const hasFrameCallback =
          typeof video.requestVideoFrameCallback === 'function';
        function scheduleFrame() {
          if (stopped) return;
          frameId = hasFrameCallback
            ? video.requestVideoFrameCallback(now => scanFrame(now))
            : requestAnimationFrame(scanFrame);
        }
        cancelFrame = () => {
          if (frameId === undefined) return;
          if (hasFrameCallback) video.cancelVideoFrameCallback(frameId);
          else cancelAnimationFrame(frameId);
          frameId = undefined;
        };

        const readQrCode = async () => {
          const detector = getQrDetector();
          if (detector) {
            try {
              // Reads the video frame natively: no canvas, no getImageData.
              const codes = await detector.detect(video);
              return codes?.[0]?.rawValue || null;
            } catch (err) {
              // Present but unusable — demote to jsqr for the session.
              qrDetector = null;
            }
          }
          const scale = Math.min(1, 480 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          // jsqr defaults inversionAttempts to 'attemptBoth', which binarizes
          // and decodes twice on every miss — and a miss is every frame until
          // the hit. The upload path in detectQrCode.web.js keeps both passes
          // because it only gets one shot at the image.
          const code = jsQR(frame.data, frame.width, frame.height, {
            inversionAttempts: 'dontInvert',
          });
          return code?.data || null;
        };

        const scanFrame = async timestamp => {
          if (stopped) return;
          // Decode at ~10fps; decoding every frame would burn CPU.
          if (
            timestamp - lastDecode > 100 &&
            video.readyState >= 2 &&
            video.videoWidth > 0
          ) {
            lastDecode = timestamp;
            const rawValue = await readQrCode();
            if (stopped) return;
            if (rawValue) {
              // Stop decoding before dispatching: the consumer takes ~200ms to
              // animate away, and the loop would otherwise keep scanning until
              // unmount. The stream stays up so the preview isn't black
              // mid-animation; the effect cleanup still stops the tracks.
              stopped = true;
              outputsRef.current.forEach(output => {
                if (output?.__isBarcodeOutput) {
                  output.onBarcodeScanned([{ format: 'qr-code', rawValue }]);
                }
              });
              return;
            }
          }
          scheduleFrame();
        };
        scheduleFrame();
      } catch (err) {
        outputsRef.current.forEach(output => {
          if (output?.__isBarcodeOutput) output.onError?.(err);
        });
      }
    }

    start();
    return () => {
      stopped = true;
      setIsStreaming(false);
      cancelFrame();
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

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('video', {
      ref: videoRef,
      autoPlay: true,
      muted: true,
      playsInline: true,
      style: {
        objectFit: 'cover',
        width: '100%',
        height: '100%',
        position: 'absolute',
        // Native previews are black while the camera warms up, not see-through.
        backgroundColor: 'black',
        ...flowStyle,
      },
    }),
    isActive &&
      !isStreaming &&
      React.createElement(ActivityIndicator, {
        size: 'large',
        color: 'white',
        style: { position: 'absolute' },
      }),
  );
}

export default Camera;
