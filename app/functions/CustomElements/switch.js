import React, {useState, useRef, useEffect} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Animated} from 'react-native';
import {COLORS, SIZES} from '../../constants';
import {useGlobalContextProvider} from '../../../context-store/context';
import GetThemeColors from '../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../context-store/theme';

const CustomToggleSwitch = ({
  page,
  toggleSwitchFunction,
  stateValue,
  containerStyles,
}) => {
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor, backgroundOffset, backgroundColor} = GetThemeColors();

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

  const animatedValue = useRef(new Animated.Value(0)).current;

  const localIsOn = stateValue != undefined ? stateValue : isOn;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: localIsOn ? 1 : 0,
      duration: 300, // Duration of the animation
      useNativeDriver: true, // Enable if animating style properties
    }).start();
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

  const circleColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [
      COLORS.darkModeText,
      darkModeType && theme ? COLORS.lightsOutBackground : COLORS.darkModeText,
    ], // From inactive to active color
  });
  const switchColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [
      page === 'cameraSlider' ||
      page === 'eCash' ||
      page === 'bankSettings' ||
      page === 'hideUnknownContacts' ||
      page === 'useTrampoline' ||
      page === 'LoginSecurityMode' ||
      page === 'fastPay'
        ? backgroundColor
        : backgroundOffset,
      darkModeType && theme ? COLORS.darkModeText : COLORS.primary,
    ], // From inactive to active color
  });
  const animatedTextColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [
      textColor,
      darkModeType && theme ? COLORS.lightsOutBackground : COLORS.white,
    ], // From inactive to active color
  });

  const circlePosition = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [5, 40], // From left to right position
  });
  // Text position animation (now properly initialized)
  const textPosition = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [33, 10], // Adjusted these values for better positioning
    extrapolate: 'clamp',
  });

  return (
    <TouchableOpacity
      onPress={() => {
        if (toggleSwitchFunction) {
          toggleSwitchFunction();
        } else {
          toggleSwitch();
        }
      }}
      style={{...containerStyles}}
      activeOpacity={0.7}>
      <Animated.View style={[styles.switch, {backgroundColor: switchColor}]}>
        <Animated.View
          style={[
            styles.circle,
            {
              transform: [{translateX: circlePosition}],
              backgroundColor: circleColor,
            },
          ]}
        />
        <Animated.Text
          style={[
            styles.text,
            {
              // left: circlePosition,
              color: animatedTextColor,
              transform: [
                {
                  translateX: textPosition,
                },
              ],
            },
          ]}>
          {localIsOn ? 'ON' : 'OFF'}
        </Animated.Text>
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
  },
  text: {
    position: 'absolute',
    fontSize: SIZES.small,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default CustomToggleSwitch;
