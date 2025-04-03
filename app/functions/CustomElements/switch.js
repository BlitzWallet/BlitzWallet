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

  console.log(localIsOn, 'LOACAL IS ON');

  const [sliderText, setSliderText] = useState(localIsOn ? 'ON' : 'OFF');

  const animatedValue = useRef(new Animated.Value(localIsOn ? 1 : 0)).current;
  const opacityTextValue = useRef(
    new Animated.Value(localIsOn ? 1 : 0),
  ).current;
  const isInitialRender = useRef(true);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: localIsOn ? 1 : 0,
      duration: 300, // Duration of the animation
      useNativeDriver: true, // Enable if animating style properties
    }).start();

    Animated.timing(opacityTextValue, {
      toValue: isInitialRender.current ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      if (isInitialRender.current) {
        isInitialRender.current = false;
      } else setSliderText(prev => (prev === 'ON' ? 'OFF' : 'ON'));
      // Change text after fade out

      // Fade in animation
      Animated.timing(opacityTextValue, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
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
  const animatedTextColor = opacityTextValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1], // From inactive to active color
  });

  const circlePosition = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [5, 40], // From left to right position
  });
  // Text position animation (now properly initialized)
  const textPosition = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [70 - textWidth - 10, 10], // Adjusted these values for better positioning
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
          onLayout={event => {
            console.log(event.nativeEvent.layout.width);
            setTextWidth(event.nativeEvent.layout.width);
          }}
          style={[
            styles.text,
            {
              // left: circlePosition,
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
          ]}>
          {sliderText}
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
