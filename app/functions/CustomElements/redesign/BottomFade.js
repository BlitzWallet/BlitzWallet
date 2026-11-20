import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../../context-store/theme';

const FADE_ABOVE = 40; // fade above the control, touches pass through
export const SOLID = 32; // depth into the control where the page colour is solid
// Bottom padding for scroll content above BottomActions: clears the fade and
// the SOLID band the scroll extends under the buttons.
export const FADE = FADE_ABOVE + SOLID;

// Soft page-colour fade behind a floating bottom control (tab bar, sticky
// button) so scrolled content dims under it instead of showing through.
// `height` = distance from the screen bottom to the control's top edge.
// Everything below that edge swallows touches; pass blockTouches={false}
// for a purely visual fade. `solid` = how far into the control the fade
// reaches full page colour; 0 when content stops at the control's top edge.
export default function BottomFade({
  height,
  blockTouches = true,
  solid = SOLID,
}) {
  const { tokens } = useTheme();
  const total = height + FADE_ABOVE;
  const end = Math.min(1, (FADE_ABOVE + solid) / total);
  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[tokens.ground + '00', tokens.ground + '59', tokens.ground]}
        locations={[0, end * (FADE_ABOVE / (FADE_ABOVE + SOLID)), end]}
        style={[styles.fill, { height: total }]}
      />
      {blockTouches && (
        // collapsable={false} keeps an empty View hit-testable on Android.
        <View collapsable={false} style={[styles.fill, { height }]} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10 },
});
