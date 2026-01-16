import MaskedView from '@react-native-masked-view/masked-view';
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dimensions, StyleSheet, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLORS, FONT, SKELETON_ANIMATION_SPEED } from '../../constants';

const WINDOW_WIDTH = Dimensions.get('window').width;

const SkeletonTextPlaceholder = ({
  children,
  enabled = true,
  backgroundColor = COLORS.offsetBackground,
  highlightColor = '#F2F8FC',
  speed = SKELETON_ANIMATION_SPEED,
  direction = 'right',
  shimmerWidth,
  layout,
}) => {
  // const [layout, setLayout] = useState();
  const progress = useSharedValue(0);
  const isAnimationReady = Boolean(speed && layout?.width && layout?.height);

  useEffect(() => {
    if (!isAnimationReady) return;
    progress.value = withRepeat(
      withTiming(1, {
        duration: speed,
        easing: Easing.ease,
      }),
      -1, // infinite
      false,
    );
  }, [isAnimationReady, speed]);

  const animatedGradientStyle = useAnimatedStyle(() => {
    const animationWidth = WINDOW_WIDTH + (shimmerWidth ?? 0);
    const translateX =
      direction === 'right'
        ? -animationWidth + progress.value * (2 * animationWidth)
        : animationWidth - progress.value * (2 * animationWidth);

    return {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      transform: [{ translateX }],
    };
  });

  const transparentColor = useMemo(
    () => getTransparentColor(highlightColor.replace(/ /g, '')),
    [highlightColor],
  );

  if (!enabled) {
    return <View style={{ width: '100%' }}>{children}</View>;
  }

  const maskElement = (
    <View style={styles.maskContainer}>
      <TextColorProvider color="white">{children}</TextColorProvider>
    </View>
  );

  // if (!layout?.width || !layout.height) {
  //   return (
  //     <View onLayout={event => setLayout(event.nativeEvent.layout)}>
  //       {maskElement}
  //     </View>
  //   );
  // }

  return (
    <MaskedView
      style={{ height: layout.height, width: '100%' }}
      maskElement={maskElement}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />
      {isAnimationReady && highlightColor && transparentColor && (
        <Animated.View style={animatedGradientStyle}>
          <LinearGradient
            {...getGradientProps(shimmerWidth)}
            colors={[transparentColor, highlightColor, transparentColor]}
          />
        </Animated.View>
      )}
    </MaskedView>
  );
};

// Context to override text colors
const TextColorContext = createContext();

const TextColorProvider = ({ children, color }) => {
  return (
    <TextColorContext.Provider value={color}>
      {transformElementsForMask(children, color)}
    </TextColorContext.Provider>
  );
};

// Recursively transform elements to override text rendering
const transformElementsForMask = (children, textColor) => {
  return Children.map(children, (child, index) => {
    if (!child) return null;

    if (typeof child === 'string') {
      return (
        <Text key={index} style={{ color: textColor }}>
          {child}
        </Text>
      );
    }

    if (isValidElement(child)) {
      const props = { key: index };

      if (child.type === Text) {
        props.style = [
          child.props?.style,
          { color: textColor, backgroundColor: 'transparent' },
        ];
      } else {
        props.style = [child.props?.style, { backgroundColor: 'transparent' }];
      }

      if (child.props?.children) {
        props.children = transformElementsForMask(
          child.props.children,
          textColor,
        );
      }

      if (child.props?.content && typeof child.props.content === 'string') {
        return (
          <Text
            key={index}
            style={[
              child.props?.styles,
              {
                color: textColor,
                backgroundColor: 'transparent',
              },
            ]}
          >
            {child.props.content}
          </Text>
        );
      }

      return cloneElement(child, props);
    }

    return child;
  });
};

const getGradientProps = width => ({
  start: { x: 0, y: 0 },
  end: { x: 1, y: 0 },
  style: { ...StyleSheet.absoluteFillObject, width },
});

const styles = StyleSheet.create({
  maskContainer: {
    backgroundColor: 'transparent',
  },
});

export default SkeletonTextPlaceholder;

const getColorType = color => {
  if (
    new RegExp(
      /^rgba\((0|255|25[0-4]|2[0-4]\d|1\d\d|0?\d?\d),(0|255|25[0-4]|2[0-4]\d|1\d\d|0?\d?\d),(0|255|25[0-4]|2[0-4]\d|1\d\d|0?\d?\d),(0|0?\.\d|1(\.0)?)\)$/,
    ).test(color)
  ) {
    return 'rgba';
  }
  if (
    new RegExp(
      /^rgb\((0|255|25[0-4]|2[0-4]\d|1\d\d|0?\d?\d),(0|255|25[0-4]|2[0-4]\d|1\d\d|0?\d?\d),(0|255|25[0-4]|2[0-4]\d|1\d\d|0?\d?\d)\)$/,
    ).test(color)
  ) {
    return 'rgb';
  }
  if (new RegExp(/^#?([a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i).test(color)) {
    return 'hex';
  }
  throw `The provided color ${color} is not a valid (hex | rgb | rgba) color`;
};

const getTransparentColor = color => {
  const type = getColorType(color);
  if (type === 'hex') {
    if (color.length < 6) {
      return color.substring(0, 4) + '0';
    }
    return color.substring(0, 7) + '00';
  }
  const [r, g, b] = color.match(/\d+/g);
  return `rgba(${r},${g},${b},0)`;
};
