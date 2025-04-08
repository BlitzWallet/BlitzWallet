import {useEffect, useRef, useState} from 'react';
import {Dimensions} from 'react-native';

import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  interpolate,
  Extrapolation,
  useAnimatedStyle,
} from 'react-native-reanimated';

export const useCustomFlatListHook = () => {
  const scrollY = useSharedValue(0);
  const [heights, setHeights] = useState({
    header: 0,
    sticky: 0,
    topList: 0,
  });
  const windowHeight = useRef(Dimensions.get('window').height).current;
  const didMount = useRef(null);

  useEffect(() => {
    didMount.current = true;
    return () => (didMount.current = false);
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;
    },
  });
  // Create animated styles using useAnimatedStyle
  const stickyElementStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [-windowHeight, heights.header],
            [windowHeight, -heights.header],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const topElementStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [-windowHeight, heights.header + heights.sticky + heights.topList],
            [
              windowHeight,
              -(heights.header + heights.sticky + heights.topList),
            ],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const styles = {
    header: {
      marginBottom: heights.sticky + heights.topList,
    },
    stickyElement: {
      left: 0,
      marginTop: heights.header,
      position: 'absolute',
      right: 0,

      zIndex: 2,
    },
    topElement: {
      left: 0,
      marginTop: heights.header + heights.sticky,
      position: 'absolute',
      right: 0,
      zIndex: 1,
    },
  };

  const onLayoutHeaderElement = event => {
    event.persist();
    if (!didMount.current) return;
    setHeights(prev => ({...prev, header: event.nativeEvent.layout.height}));
  };

  const onLayoutTopListElement = event => {
    event.persist();
    if (!didMount.current) return;
    setHeights(prev => ({...prev, topList: event.nativeEvent.layout.height}));
  };

  const onLayoutTopStickyElement = event => {
    event.persist();
    if (!didMount.current) return;
    setHeights(prev => ({...prev, sticky: event.nativeEvent.layout.height}));
  };

  return [
    scrollHandler,
    styles,
    stickyElementStyle,
    topElementStyle,
    onLayoutHeaderElement,
    onLayoutTopListElement,
    onLayoutTopStickyElement,
  ];
};
