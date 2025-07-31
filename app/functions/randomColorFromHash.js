import {COLORS} from '../constants';
import sha256Hash from './hash';

export function stringToColorCrypto(str, mode = 'light') {
  try {
    const hex = sha256Hash(str);
    const int1 = parseInt(hex.slice(0, 4), 16);
    const int2 = parseInt(hex.slice(4, 8), 16);
    const int3 = parseInt(hex.slice(8, 12), 16);

    if (mode === 'dark' || mode === 'light') {
      // For light mode, use your theme's blue palette as inspiration
      const hueVariants = [
        210, // Primary blue family
        205, // Slightly shifted
        215, // Slightly shifted other way
        200, // Tertiary blue family
        220, // Extended range
        195, // Extended range
      ];

      const hue = hueVariants[int1 % hueVariants.length];
      const saturation = 60 + (int2 % 30); // Range: 60-90% (vibrant but not overwhelming)
      const lightness = 35 + (int3 % 25); // Range: 35-60% (readable on light backgrounds)

      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    } else {
      // For lights out mode (black background), use even lighter colors
      const hue = 0;
      const saturation = 0; // Slightly less saturated
      const lightness = 60 + (int3 % 30); // Range: 60-90% (very readable on black)
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
  } catch (err) {
    console.error('Error converting string to color:', err);
    // Fallback colors that match your theme
    if (mode === 'dark') {
      return '#6AB1FF'; // giftcardblue3
    } else if (mode === 'lightsout') {
      return '#676767'; // giftcardlightsout3
    } else {
      return '#0375F6'; // primary
    }
  }
}

export function getContrastingTextColor(hslColor) {
  const hslMatch = hslColor.match(/^hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)$/i);

  if (!hslMatch) {
    console.error('Invalid HSL format:', hslColor);
    return COLORS.lightModeText;
  }

  const h = parseInt(hslMatch[1], 10);
  const s = parseFloat(hslMatch[2]) / 100;
  const l = parseFloat(hslMatch[3]) / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h / 360 + 1 / 3);
    g = hue2rgb(p, q, h / 360);
    b = hue2rgb(p, q, h / 360 - 1 / 3);
  }

  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  console.log(luminance);

  return luminance > 0.7 ? COLORS.lightModeText : COLORS.darkModeText;
}
