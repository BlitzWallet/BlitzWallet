import MaskedView from '@react-native-masked-view/masked-view';
import * as React from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  View,
  Text,
} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {COLORS, SKELETON_ANIMATION_SPEED} from '../../constants';

const WINDOW_WIDTH = Dimensions.get('window').width;

const SkeletonTextPlaceholder = ({
  children,
  enabled = true,
  backgroundColor = COLORS.offsetBackground,
  highlightColor = '#F2F8FC',
  speed = SKELETON_ANIMATION_SPEED,
  direction = 'right',
  shimmerWidth,
}) => {
  const [layout, setLayout] = React.useState();
  const animatedValueRef = React.useRef(new Animated.Value(0));
  const isAnimationReady = Boolean(speed && layout?.width && layout?.height);

  React.useEffect(() => {
    if (!isAnimationReady) return;
    const loop = Animated.loop(
      Animated.timing(animatedValueRef.current, {
        toValue: 1,
        duration: speed,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [isAnimationReady, speed]);

  const animatedGradientStyle = React.useMemo(() => {
    const animationWidth = WINDOW_WIDTH + (shimmerWidth ?? 0);
    return {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      transform: [
        {
          translateX: animatedValueRef.current.interpolate({
            inputRange: [0, 1],
            outputRange:
              direction === 'right'
                ? [-animationWidth, animationWidth]
                : [animationWidth, -animationWidth],
          }),
        },
      ],
    };
  }, [direction, WINDOW_WIDTH, shimmerWidth]);

  const transparentColor = React.useMemo(
    () => getTransparentColor(highlightColor.replace(/ /g, '')),
    [highlightColor],
  );

  if (!enabled) return children;

  // Simple approach: render the children with white text color for masking
  const maskElement = (
    <View style={styles.maskContainer}>
      <TextColorProvider color="white">{children}</TextColorProvider>
    </View>
  );

  if (!layout?.width || !layout.height) {
    return (
      <View onLayout={event => setLayout(event.nativeEvent.layout)}>
        {maskElement}
      </View>
    );
  }

  return (
    <MaskedView
      style={{height: layout.height, width: layout.width}}
      maskElement={maskElement}>
      <View style={[StyleSheet.absoluteFill, {backgroundColor}]} />
      {isAnimationReady &&
        highlightColor !== undefined &&
        transparentColor !== undefined && (
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
const TextColorContext = React.createContext();

const TextColorProvider = ({children, color}) => {
  return (
    <TextColorContext.Provider value={color}>
      {transformElementsForMask(children, color)}
    </TextColorContext.Provider>
  );
};

// Recursively transform elements to override text rendering
const transformElementsForMask = (children, textColor) => {
  return React.Children.map(children, (child, index) => {
    if (!child) return null;

    if (typeof child === 'string') {
      return (
        <Text key={index} style={{color: textColor}}>
          {child}
        </Text>
      );
    }

    if (React.isValidElement(child)) {
      const props = {key: index};

      // If it's a Text component, override the color
      if (child.type === Text) {
        props.style = [
          child.props?.style,
          {color: textColor, backgroundColor: 'transparent'},
        ];
      } else {
        // For other components, make sure background is transparent
        props.style = [child.props?.style, {backgroundColor: 'transparent'}];
      }

      // If it has children, recursively transform them
      if (child.props?.children) {
        props.children = transformElementsForMask(
          child.props.children,
          textColor,
        );
      }

      // Handle custom text components that might use a 'content' prop
      if (child.props?.content && typeof child.props.content === 'string') {
        // This is likely a custom text component like ThemeText
        // We'll create a regular Text component instead
        return (
          <Text
            key={index}
            style={[
              child.props?.style,
              {color: textColor, backgroundColor: 'transparent'},
            ]}>
            {child.props.content}
          </Text>
        );
      }

      return React.cloneElement(child, props);
    }

    return child;
  });
};

const getGradientProps = width => ({
  start: {x: 0, y: 0},
  end: {x: 1, y: 0},
  style: {...StyleSheet.absoluteFillObject, width},
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
