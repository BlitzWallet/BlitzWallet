import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context-store/theme';

// Thin 8 pt progress bar (D301, X21-2): track `disc`, accent fill, r999.
export default function ProgressBar({ value = 0, height = 8, style }) {
  const { tokens } = useTheme();
  const clamped = Math.min(Math.max(Number(value) || 0, 0), 1);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(clamped * 100),
      }}
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: tokens.disc },
        style,
      ]}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: tokens.accent,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden' },
});
