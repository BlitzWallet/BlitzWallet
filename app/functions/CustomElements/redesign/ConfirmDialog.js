import { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../../context-store/theme';
import { FONT } from '../../../constants';
import ThemeText from '../textTheme';
import CustomScrollView from '../scrollView';
import Disc from './Disc';

// Centred alert dialog (route 'ConfirmDialog'). Params:
// title?, message, icon? (44 disc, accent glyph), confirmLabel,
// cancelLabel? (omit for a single button), onConfirm?, onCancel?
// The message is muted under a title, ink when it stands alone.
export default function ConfirmDialog(props) {
  const navigate = useNavigation();
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
    <AlertDialog
      title={title}
      message={message}
      icon={icon}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}

// The dialog itself, for popup routes that own their navigation
// (ErrorScreen, ConfirmActionPage, InformationPopup). Card scales 0.96 → 1
// over 150 ms while the route fades the scrim. A tap outside runs
// `onDismiss`, else `onCancel`, else `onConfirm`. Long text scrolls.
export function AlertDialog({
  title,
  message,
  icon,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  onDismiss,
}) {
  const { tokens } = useTheme();
  const scale = useSharedValue(0.96);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 150 });
  }, [scale]);

  const dialogStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[styles.overlay, { backgroundColor: tokens.scrim }]}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onDismiss || onCancel || onConfirm}
        accessible={false}
      />
      <Animated.View
        accessibilityRole="alert"
        style={[
          styles.dialog,
          { backgroundColor: tokens.surface },
          dialogStyle,
        ]}
      >
        <CustomScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
        >
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
          {children}
        </CustomScrollView>
        <View style={[styles.buttonRow, { borderTopColor: tokens.divider }]}>
          {!!cancelLabel && (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.button}
              onPress={onCancel}
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
            onPress={onConfirm}
          >
            <ThemeText
              styles={[styles.buttonText, { color: tokens.link }]}
              content={confirmLabel}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
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
    maxHeight: '70%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
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
