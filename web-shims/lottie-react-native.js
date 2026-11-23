// Web shim for lottie-react-native. Maps the LottieView prop contract used
// across the app (source / ref+.play() / loop / autoPlay / progress / style) onto
// lottie-react. See metro.config.js WEB_STUBS.
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Lottie from 'lottie-react';

const LottieView = forwardRef(
  ({ source, autoPlay, loop, progress, style }, ref) => {
    const innerRef = useRef(null);
    const fixed = typeof progress === 'number';
    // lottie-react fills innerRef.current in an effect (after this handle is
    // set), so delegate lazily -> call sites' animationRef.current.play() works
    useImperativeHandle(
      ref,
      () =>
        new Proxy(
          {},
          { get: (_, key) => (...args) => innerRef.current?.[key]?.(...args) },
        ),
      [],
    );

    return (
      <Lottie
        lottieRef={innerRef}
        animationData={source} // source -> animationData
        autoplay={!fixed && !!autoPlay} // autoPlay -> autoplay
        loop={fixed ? false : loop}
        onDOMLoaded={
          fixed
            ? () => {
                const anim = innerRef.current;
                anim?.goToAndStop(
                  progress * (anim.getDuration(true) - 1),
                  true,
                );
              }
            : undefined
        }
        style={StyleSheet.flatten(style)} // normalize StyleSheet refs + inline objects to a plain DOM style
      />
    );
  },
);

export default LottieView;
