import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useGlobalThemeContext } from '../../../context-store/theme';

// 52 × 32 track, 28 knob (I.13). Controlled via `stateValue`; the legacy
// `page` path still writes masterInfoObject for un-migrated screens.
const CustomToggleSwitch = ({
  page,
  toggleSwitchFunction,
  stateValue,
  containerStyles,
  accessibilityLabel,
}) => {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { tokens } = useGlobalThemeContext();
  const isOn =
    page === 'cameraSlider'
      ? masterInfoObject.enabledSlidingCamera
      : page === 'eCash'
      ? !!masterInfoObject.enabledEcash
      : page === 'hideUnknownContacts'
      ? masterInfoObject.hideUnknownContacts
      : page === 'useTrampoline'
      ? masterInfoObject.useTrampoline
      : false;
  const localIsOn =
    stateValue !== undefined && stateValue !== null ? stateValue : isOn;

  const animatedValue = useSharedValue(localIsOn ? 1 : 0);

  useEffect(() => {
    animatedValue.value = withTiming(localIsOn ? 1 : 0, { duration: 200 });
  }, [localIsOn]);

  const toggleSwitch = () => {
    toggleMasterInfoObject({
      [page === 'hideUnknownContacts'
        ? 'hideUnknownContacts'
        : page === 'cameraSlider'
        ? 'enabledSlidingCamera'
        : page === 'eCash'
        ? 'enabledEcash'
        : 'useTrampoline']: !localIsOn,
    });
  };

  const switchStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      animatedValue.value,
      [0, 1],
      [tokens.grab, tokens.accent],
    ),
  }));
  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 2 + animatedValue.value * 20 }],
  }));

  return (
    <TouchableOpacity
      onPress={() => {
        if (toggleSwitchFunction) {
          toggleSwitchFunction();
        } else {
          toggleSwitch();
        }
      }}
      style={[styles.touch, containerStyles]}
      activeOpacity={0.7}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!localIsOn }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.switch, switchStyle]}>
        <Animated.View style={[styles.circle, circleStyle]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touch: { width: 52, height: 44, alignItems: 'center', justifyContent: 'center' },
  switch: {
    width: 52,
    height: 32,
    borderRadius: 999,
    justifyContent: 'center',
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 2,
    left: 0,
    zIndex: 1,
    shadowColor: '#15161A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
});

export default CustomToggleSwitch;
