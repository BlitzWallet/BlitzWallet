import jsQR from 'jsqr';

// Web counterpart of detectQrCode.js. rn-qr-generator is mapped to the generic
// empty stub on web (metro.config.js WEB_STUBS), so its detect() returns
// nothing there. The live camera shim already decodes with jsQR — use the same
// browser decoder for uploaded images. Lives in a .web.js file so jsqr never
// ships in the native bundles.
function loadWebImage(src) {
  return new Promise((resolve, reject) => {
    // window.Image (not a bare Image global) so eslint no-undef passes —
    // bare Image is not in the RN eslint env.
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('Unable to load image for QR detection'));
    img.src = src;
  });
}

export async function detectQRCode(uri) {
  try {
    if (!uri || typeof uri !== 'string') return null;
    if (
      typeof document === 'undefined' ||
      typeof window === 'undefined' ||
      typeof window.Image === 'undefined'
    ) {
      return null;
    }
    const img = await loadWebImage(uri);
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    if (!naturalWidth || !naturalHeight) return null;

    // Bound decode cost like the native width-400 resize; keep aspect ratio.
    const maxDimension = 800;
    const scale = Math.min(
      1,
      maxDimension / Math.max(naturalWidth, naturalHeight),
    );
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    const frame = ctx.getImageData(0, 0, width, height);
    const code = jsQR(frame.data, frame.width, frame.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (!code?.data) return null;
    // Preserve the rn-qr-generator result contract relied on by
    // sendBitcoin/getQRImage ({type, values}).
    return {type: 'QRCode', values: [code.data]};
  } catch (error) {
    console.error('QR detection failed:', error);
    return null;
  }
}
