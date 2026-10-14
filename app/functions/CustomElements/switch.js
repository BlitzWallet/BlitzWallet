import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { COLORS, SIZES } from '../../constants';
import { useGlobalContextProvider } from '../../../context-store/context';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useTranslation } from 'react-i18next';

const CustomToggleSwitch = ({
  page,
  toggleSwitchFunction,
  stateValue,
  containerStyles,
}) => {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundOffset, backgroundColor } = GetThemeColors();
  const [textWidth, setTextWidth] = useState(0);
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
  const localIsOn = stateValue != undefined ? stateValue : isOn;

  const [sliderText, setSliderText] = useState(localIsOn ? 'ON' : 'OFF');

  const animatedValue = useSharedValue(localIsOn ? 1 : 0);
  const opacityTextValue = useSharedValue(localIsOn ? 1 : 0);
  const isInitialRender = useRef(true);

  useEffect(() => {
    animatedValue.value = withTiming(localIsOn ? 1 : 0, { duration: 300 });

    const onTextFadeOut = () => {
      if (isInitialRender.current) {
        isInitialRender.current = false;
      } else setSliderText(prev => (prev === 'ON' ? 'OFF' : 'ON'));
      // Change text after fade out

      // Fade in animation
      opacityTextValue.value = withTiming(1, { duration: 150 });
    };

    opacityTextValue.value = withTiming(
      isInitialRender.current ? 1 : 0,
      { duration: 150 },
      () => {
        scheduleOnRN(onTextFadeOut);
      },
    );
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

  const useAltStyle =
    page === 'cameraSlider' ||
    page === 'eCash' ||
    page === 'bankSettings' ||
    page === 'hideUnknownContacts' ||
    page === 'useTrampoline' ||
    page === 'LoginSecurityMode' ||
    page === 'fastPay' ||
    page === 'nwcAccount' ||
    page === 'lrc20Settings' ||
    page === 'useRanomPinLayout' ||
    page === 'settingsNotifications' ||
    page === 'settingsCrashReporting' ||
    page === 'tipPaymentStatus' ||
    page === 'liquidSwap' ||
    page === 'pinAccount' ||
    page === 'spendAndReplace';

  const circleColors = [
    useAltStyle
      ? theme
        ? COLORS.darkModeText
        : COLORS.primary
      : COLORS.darkModeText,
    useAltStyle
      ? theme
        ? backgroundColor
        : COLORS.darkModeText
      : darkModeType && theme
      ? COLORS.lightsOutBackground
      : COLORS.darkModeText,
  ]; // From inactive to active color
  const switchColors = [
    useAltStyle
      ? theme
        ? backgroundColor
        : COLORS.darkModeText
      : backgroundOffset,
    darkModeType && theme ? COLORS.darkModeText : COLORS.primary,
  ]; // From inactive to active color

  const switchStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      animatedValue.value,
      [0, 1],
      switchColors,
    ),
  }));
  const circleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      animatedValue.value,
      [0, 1],
      circleColors,
    ),
    transform: [{ translateX: 5 + animatedValue.value * 35 }], // From left to right position
  }));

  const sliderTextLength = t(
    `constants.${sliderText.toLowerCase()}Lower`,
  ).length;

  return (
    <TouchableOpacity
      onPress={() => {
        if (toggleSwitchFunction) {
          toggleSwitchFunction();
        } else {
          toggleSwitch();
        }
      }}
      style={containerStyles}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.switch, switchStyle]}>
        <Animated.View style={[styles.circle, circleStyle]} />
        {/* <Animated.Text
          onLayout={event => {
            console.log(event.nativeEvent.layout.width);
            setTextWidth(event.nativeEvent.layout.width);
          }}
          numberOfLines={1}
          style={[
            styles.text,
            {
              // left: circlePosition,
              flexShrink: 1,
              color: localIsOn
                ? darkModeType && theme
                  ? COLORS.lightsOutBackground
                  : COLORS.white
                : textColor, // From inactive to active color
              opacity: animatedTextColor,
              transform: [
                {
                  translateX: textPosition,
                },
              ],
            },
          ]}
        >
          {`${t(`constants.${sliderText.toLowerCase()}Lower`)
            .slice(0, 3)
            .toUpperCase()}${sliderTextLength > 3 ? '.' : ''}`}
        </Animated.Text> */}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  switch: {
    width: 70,
    height: 35,
    borderRadius: 20,
    justifyContent: 'center',
    // paddingHorizontal: 20,
  },
  circle: {
    width: 24,
    height: 24,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    position: 'absolute',
    zIndex: 1,
  },
  text: {
    position: 'absolute',
    fontSize: SIZES.small,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default CustomToggleSwitch;
