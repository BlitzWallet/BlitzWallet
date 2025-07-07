import React, {useEffect, useRef} from 'react';
import {View, StyleSheet, Animated, PanResponder} from 'react-native';
import {ThemeText} from '../functions/CustomElements';
import ThemeImage from '../functions/CustomElements/themeImage';
import {COLORS, ICONS} from '../constants';
import {useGlobalInsets} from '../../context-store/insetsProvider';

export function Toast({toast, onHide, expiredToasts}) {
  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const {topPadding} = useGlobalInsets();

  useEffect(() => {
    // Slide in animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!expiredToasts) return;
    if (expiredToasts !== toast.id) return;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100, // Slide up off screen
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => onHide());
  }, [expiredToasts]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5; // Only start gesture if dragging vertically
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow upward movement (negative dy) to dismiss
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -topPadding) {
          // Swipe up threshold of 50px
          // Swipe to dismiss - slide up and fade out
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -100, // Slide up off screen
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ]).start(() => onHide());
        } else {
          // Bounce back to original position
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const getToastStyle = () => {
    const baseStyle = [styles.toast];
    switch (toast.type) {
      case 'clipboard':
        return [...baseStyle, styles.clipboardToast];
      case 'success':
        return [...baseStyle, styles.successToast];
      case 'error':
        return [...baseStyle, styles.errorToast];
      case 'warning':
        return [...baseStyle, styles.warningToast];
      case 'info':
        return [...baseStyle, styles.infoToast];
      default:
        return [...baseStyle, styles.defaultToast];
    }
  };

  const getIconForType = () => {
    switch (toast.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          top: topPadding,
          transform: [
            {translateY: Animated.add(slideAnim, translateY)}, // Combine slide-in and pan animations
          ],
          opacity: opacityAnim,
        },
      ]}
      {...panResponder.panHandlers}>
      <View style={getToastStyle()}>
        <View style={styles.toastContent}>
          {toast.type === 'clipboard' ? (
            <ThemeImage
              styles={{width: 25, height: 25, marginRight: 15}}
              lightModeIcon={ICONS.clipboardDark}
              darkModeIcon={ICONS.clipboardDark}
              lightsOutIcon={ICONS.clipboardDark}
            />
          ) : (
            <ThemeText styles={styles.toastIcon} content={getIconForType()} />
          )}
          <View style={styles.textContainer}>
            <ThemeText styles={styles.toastTitle} content={toast.title} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// Styles
const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  toast: {
    borderRadius: 8,
    padding: 15,
  },
  clipboardToast: {
    backgroundColor: COLORS.darkModeText,
  },
  successToast: {
    backgroundColor: '#4CAF50',
  },
  errorToast: {
    backgroundColor: '#F44336',
  },
  warningToast: {
    backgroundColor: '#FF9800',
  },
  infoToast: {
    backgroundColor: '#2196F3',
  },
  defaultToast: {
    backgroundColor: '#323232',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toastIcon: {
    fontSize: 20,
    color: 'white',
    marginRight: 12,
    fontWeight: 'bold',
  },
  textContainer: {
    flex: 1,
  },
  toastTitle: {
    color: COLORS.lightModeText,
    includeFontPadding: false,
  },
});
