import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../../context-store/theme';

// How far content slides up under the header, fading from clear at the
// header's bottom edge to solid near its top, so it shows faintly behind the
// title as it scrolls away.
export const SOLID = 48;
const FADE_BELOW = 10; // overlap={false}: fade below the header, touches pass through
// Top padding for scroll content under a TopHeader (and TopBar fade): clears
// the SOLID band the scroll view extends under the header, so content rests
// at its bottom edge.
export const FADE_TOP = SOLID;

export const FADE_TOP_BUFFER = 10;

// Eased solid → clear ramp. A 3-stop linear ramp shows a visible "knee";
// these stops trace an ease-in-out curve so the edge has no line.
export const RAMP = [1, 0.97, 0.9, 0.78, 0.6, 0.4, 0.22, 0.1, 0.03, 0];
export const hex = a =>
  Math.round(a * 255)
    .toString(16)
    .padStart(2, '0');

// Softens the header's bottom edge so scrolled content dissolves under it
// instead of cutting off at a hard line. `height` = the header's height.
// Purely visual. `solid` = the band at the header's bottom edge that ramps to
// clear; 0 when content stops at the header's bottom edge (overlap={false}),
// in which case the ramp is drawn FADE_BELOW below the header instead.
export default function TopFade({ height, solid = SOLID }) {
  const { tokens } = useTheme();
  const total = height + (solid ? 0 : FADE_BELOW);
  const start = 1 - Math.min(1, (solid || FADE_BELOW) / total);
  const step = (1 - start) / (RAMP.length - 1);
  return (
    <LinearGradient
      pointerEvents="none"
      colors={RAMP.map(a => tokens.ground + hex(a))}
      locations={RAMP.map((_, i) => start + i * step)}
      style={[styles.fill, { height: total }]}
    />
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
});
