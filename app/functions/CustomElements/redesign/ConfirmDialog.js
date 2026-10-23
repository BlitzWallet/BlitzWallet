import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../../context-store/theme';
import { FONT } from '../../../constants';
import ThemeText from '../textTheme';
import Disc from './Disc';

// Centred alert dialog (route 'ConfirmDialog'). Params:
// title?, message, icon? (44 disc, accent glyph), confirmLabel,
// cancelLabel? (omit for a single button), onConfirm?, onCancel?
// The message is muted under a title, ink when it stands alone.
export default function ConfirmDialog(props) {
  const navigate = useNavigation();
  const { tokens } = useTheme();
  const {
    title,
    message,
    icon,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
  } = props.route.params || {};

  const handleConfirm = () => {
    navigate.goBack();
    if (!onConfirm) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onConfirm();
      });
    });
  };

  const handleCancel = () => {
    navigate.goBack();
    onCancel?.();
  };

  return (
    <View style={[styles.overlay, { backgroundColor: tokens.scrim }]}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={handleCancel}
        accessible={false}
      />
      <View
        accessibilityRole="alert"
        style={[styles.dialog, { backgroundColor: tokens.surface }]}
      >
        <View style={styles.body}>
          {!!icon && (
            <View style={styles.icon}>
              <Disc icon={icon} size={44} iconSize={20} tone="accent" />
            </View>
          )}
          {!!title && <ThemeText styles={styles.title} content={title} />}
          {!!message && (
            <ThemeText
              styles={[
                styles.message,
                { color: title ? tokens.muted : tokens.ink },
              ]}
              content={message}
            />
          )}
        </View>
        <View style={[styles.buttonRow, { borderTopColor: tokens.divider }]}>
          {!!cancelLabel && (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.button}
              onPress={handleCancel}
            >
              <ThemeText
                styles={[styles.buttonText, { color: tokens.ink }]}
                content={cancelLabel}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            style={[
              styles.button,
              !!cancelLabel && {
                borderLeftWidth: 1,
                borderLeftColor: tokens.divider,
              },
            ]}
            onPress={handleConfirm}
          >
            <ThemeText
              styles={[styles.buttonText, { color: tokens.link }]}
              content={confirmLabel}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  dialog: {
    width: '100%',
    maxWidth: 326,
    borderRadius: 24,
    overflow: 'hidden',
  },
  body: {
    paddingTop: 24,
    paddingHorizontal: 22,
    paddingBottom: 20,
  },
  icon: {
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: FONT.Title_Regular,
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 6,
    textAlign: 'center',
    includeFontPadding: false,
  },
  message: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
  buttonRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  buttonText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
