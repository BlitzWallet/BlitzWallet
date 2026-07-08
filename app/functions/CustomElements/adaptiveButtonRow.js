import { StyleSheet, View } from 'react-native';
import useAdaptiveButtonLayout from '../../hooks/useAdaptiveButtonLayout';

// Standardized container for two (or one) side-by-side buttons that automatically
// switch between a row and a stacked column layout depending on whether the button
// text fits. It owns all the shared layout boilerplate — the container flex styles,
// the onLayout wiring, and the hidden measurement layer — so call sites only provide
// the (heterogeneous) buttons themselves via a render-prop child.
//
// The child receives `{ shouldStack, buttonStyle }`; spread `buttonStyle` onto each
// button so it gets `flex:1` in a row or `width:'100%'` when stacked.
export default function AdaptiveButtonRow({
  labels,
  children,
  containerStyle,
  gap = 10,
  buttonHorizontalPadding,
  minWidth,
  textStyle,
}) {
  const { shouldStack, containerProps, measureElement } = useAdaptiveButtonLayout(
    labels,
    { gap, buttonHorizontalPadding, minWidth, textStyle },
  );

  const buttonStyle = shouldStack ? styles.buttonStacked : styles.buttonColumn;

  return (
    <View
      {...containerProps}
      style={[
        styles.base,
        { gap },
        shouldStack ? styles.stacked : styles.row,
        containerStyle,
      ]}
    >
      {measureElement}
      {children({ shouldStack, buttonStyle })}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center' },
  stacked: { flexDirection: 'column', justifyContent: 'flex-start' },
  buttonColumn: { flex: 1 },
  buttonStacked: { width: '100%' },
});
