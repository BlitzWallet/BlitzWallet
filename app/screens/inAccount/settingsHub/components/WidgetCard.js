import { Pressable, StyleSheet, View } from 'react-native';
import GetThemeColors from '../../../../hooks/themeColors';

export default function WidgetCard({ children, onPress, style, contentStyle }) {
  const { backgroundOffset } = GetThemeColors();
  const isInteractive = !!onPress;

  return (
    <Pressable
      disabled={!isInteractive}
      onPress={onPress}
      delayLongPress={180}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: backgroundOffset },
        style,
        pressed && isInteractive ? styles.pressed : null,
      ]}
    >
      <View style={contentStyle}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  pressed: {
    opacity: 0.78,
  },
});
