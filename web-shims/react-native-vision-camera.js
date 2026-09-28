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

// Browsers only report torch support on a live track's getCapabilities(), so
// hasTorch stays undefined until a stream starts (see setHasTorch). Consumers
// snapshot the device object, so it is replaced rather than mutated.
let backDevice = hasWebcam ? { deviceId: 'back', position: 'back' } : null;

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
// 'nodevice' and 'busy' are kept apart from 'denied': neither is a permission
// problem, so neither may send the user to browser settings. 'prompt-dismissed'
// is the third failure: the user closed the browser prompt (the X) without
// choosing. Access is not granted, but a new prompt can still be shown, so it
// must not be treated as a permanent block.
let cameraStatus = hasWebcam ? 'unknown' : 'denied';
// True once a getUserMedia attempt has run this session. On the web the first
// attempt is <Camera>'s own getUserMedia, so consumers use this to stop their
// focus effect from probing again after a failure — that second probe is a
// second browser prompt, and Chrome hard-blocks the origin after a few.
let permissionAttempted = false;
// useSyncExternalStore requires a cached snapshot, so the state is one object
// replaced only when a value actually changes.
let cameraState = { status: cameraStatus, permissionAttempted };
const listeners = new Set();
function emit() {
  cameraState = { status: cameraStatus, permissionAttempted };
  listeners.forEach(listener => listener());
}
function setCameraStatus(status) {
  if (cameraStatus === status) return;
  cameraStatus = status;
  emit();
}
function markPermissionAttempted() {
  if (permissionAttempted) return;
  permissionAttempted = true;
  emit();
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getCameraState() {
  return cameraState;
}
function getBackDevice() {
  return backDevice;
}
function setHasTorch(hasTorch) {
  if (!backDevice || backDevice.hasTorch === hasTorch) return;
  backDevice = { ...backDevice, hasTorch };
  listeners.forEach(listener => listener());
}

// getUserMedia rejects with a DOMException; map the names browsers actually
// use onto the states the app can render. NotAllowedError is the interesting
// one: it covers both an explicit Block and dismissing the prompt, and only the
// Permissions API separates them — state 'prompt' means the prompt was
// dismissed and can be shown again; anything else means settings is the only
// way back in. Browsers without the API (Safari) keep the old 'denied'
// behavior, as does an opaque failure.
async function classifyCameraError(err) {
  switch (err?.name) {
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'nodevice';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'busy';
  }
  try {
    const permission = await navigator.permissions?.query({ name: 'camera' });
    if (permission?.state === 'prompt') return 'prompt-dismissed';
  } catch {
    // Permissions API absent or doesn't know the camera name.
  }
  return 'denied';
}

async function probeCamera() {
  if (!hasWebcam) return false;
  markPermissionAttempted();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: VIDEO_CONSTRAINTS,
    });
    stream.getTracks().forEach(track => track.stop());
    setCameraStatus('granted');
    return true;
  } catch (err) {
    setCameraStatus(await classifyCameraError(err));
    return false;
  }
}

// Native's requestPermission opens the OS prompt directly. The web's only
// permission prompt is getUserMedia, and <Camera> issues one on mount, so
// re-asking just resets the state to 'unknown'. Consumers then mount <Camera>
// and get the prompt — instead of this opening a probe stream that the real
// preview stream would immediately follow.
function requestPermission() {
  if (!hasWebcam) return;
  setCameraStatus('unknown');
}

export function useCameraPermission() {
  const { status, permissionAttempted: attempted } = useSyncExternalStore(
    subscribe,
    getCameraState,
  );
  return {
    status,
    hasPermission: status !== 'denied' && status !== 'prompt-dismissed',
    // Mirrors the native API: true while a new prompt can still be shown.
    // 'unknown' is the web's 'not-determined'; a dismissed prompt can be shown
    // again, while a blocked one can only be undone in browser settings.
    canRequestPermission: status === 'unknown' || status === 'prompt-dismissed',
    // Web-only, undefined on native: a probe already ran, so consumers must not
    // auto-probe again even though a prompt is technically still available.
    hasAttemptedPermission: attempted,
    requestPermission,
  };
}

export async function requestCameraPermission() {
  return (await probeCamera()) ? 'granted' : 'denied';
}

export function useCameraDevice() {
  const { status } = useSyncExternalStore(subscribe, getCameraState);
  const device = useSyncExternalStore(subscribe, getBackDevice);
  return status === 'nodevice' ? null : device;
}
export function useCameraDevices() {
  const { status } = useSyncExternalStore(subscribe, getCameraState);
  const device = useSyncExternalStore(subscribe, getBackDevice);
  return device && status !== 'nodevice' ? [device] : [];
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
  // Bumped when the browser kills the stream out from under us (page hidden,
  // capture interrupted). Re-runs the effect so start() reopens the camera.
  const [restartToken, setRestartToken] = useState(0);
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
    let muteTimer;

    function stopStream() {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = undefined;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    // iOS Safari/PWA ends (or leaves muted) MediaStreamTracks when the page is
    // hidden. video.srcObject still points at the dead stream, so the decode
    // loop spins on a frozen frame and the effect — keyed on focus, not
    // visibility — never re-runs. Watch for that and reopen the camera.
    function restartCamera() {
      if (stopped) return;
      if (document.visibilityState !== 'visible') return;
      if (
        cameraStatus === 'denied' ||
        cameraStatus === 'prompt-dismissed' ||
        cameraStatus === 'nodevice'
      ) {
        return;
      }
      setRestartToken(token => token + 1);
    }

    function streamIsDead() {
      const tracks = stream?.getTracks?.() || [];
      return (
        tracks.length === 0 ||
        tracks.some(track => track.readyState === 'ended')
      );
    }

    function handleVisibilityChange() {
      clearTimeout(muteTimer);
      if (document.visibilityState !== 'visible' || stopped) return;
      if (streamIsDead()) {
        restartCamera();
        return;
      }
      // A track that is merely muted usually unmutes on its own; reopen only
      // if the browser doesn't bring the capture back.
      if (stream?.getTracks().some(track => track.muted)) {
        muteTimer = setTimeout(() => {
          if (stopped) return;
          const tracks = stream?.getTracks() || [];
          if (tracks.some(track => track.muted)) restartCamera();
        }, 500);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    async function start() {
      try {
        try {
          markPermissionAttempted();
          stream = await navigator.mediaDevices.getUserMedia({
            video: VIDEO_CONSTRAINTS,
          });
        } catch (err) {
          setCameraStatus(await classifyCameraError(err));
          throw err;
        }
        setCameraStatus('granted');
        // Chrome Android reports { torch: true } here; browsers without torch
        // support report nothing. Probe before the unmount check so the
        // device-level fact survives a scanner that closed mid-prompt.
        try {
          setHasTorch(!!stream.getTracks()[0]?.getCapabilities?.().torch);
        } catch (err) {
          setHasTorch(false);
        }
        // getUserMedia() resolves asynchronously: the scanner may have
        // unmounted (stopped) or its video element may be gone while
        // permission was pending. Stop the fresh stream in either case —
        // returning early without stopping leaks an active camera track.
        const video = videoRef.current;
        if (!video || stopped) {
          stopStream();
          return;
        }
        stream.getTracks().forEach(track => {
          track.addEventListener('ended', restartCamera);
        });
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
      clearTimeout(muteTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (stream) {
        stream.getTracks().forEach(track => {
          track.removeEventListener('ended', restartCamera);
        });
      }
      setIsStreaming(false);
      cancelFrame();
      stopStream();
    };
  }, [isActive, restartToken]);

  const isTorchOn = torchMode === 'on';
  useEffect(() => {
    videoRef.current?.srcObject?.getTracks().forEach(async track => {
      try {
        await track.applyConstraints({ advanced: [{ torch: isTorchOn }] });
      } catch (err) {
        // Torch unsupported in this browser — flash button is a silent no-op.
      }
    });
    // isStreaming re-applies the current torch state to a restarted stream.
  }, [isTorchOn, isStreaming]);

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
