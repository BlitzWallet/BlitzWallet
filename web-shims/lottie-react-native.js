// Web shim for lottie-react-native. Maps the LottieView prop contract used
// across the app (source / ref+.play() / loop / autoPlay / style) onto
// lottie-react. See metro.config.js WEB_STUBS.
import React, { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import Lottie from 'lottie-react';

const LottieView = forwardRef(({ source, autoPlay, loop, style }, ref) => (
  <Lottie
    lottieRef={ref} // ref.current gets { play, stop, ... } -> call sites' animationRef.current.play() works
    animationData={source} // source -> animationData
    autoplay={!!autoPlay} // autoPlay -> autoplay
    loop={loop}
    style={StyleSheet.flatten(style)} // normalize StyleSheet refs + inline objects to a plain DOM style
  />
));

export default LottieView;
