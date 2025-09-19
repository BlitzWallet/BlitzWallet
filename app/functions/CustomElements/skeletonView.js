import MaskedView from '@react-native-masked-view/masked-view';
import {Dimensions, Fragment, StyleSheet, View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {SKELETON_ANIMATION_SPEED} from '../../constants';
import {Children, useEffect, useMemo, useState} from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const WINDOW_WIDTH = Dimensions.get('window').width;
const logEnabled = false;

const SkeletonPlaceholder = ({
  children,
  enabled = true,
  backgroundColor = '#E1E9EE',
  highlightColor = '#F2F8FC',
  speed = SKELETON_ANIMATION_SPEED,
  direction = 'right',
  borderRadius,
  shimmerWidth,
}) => {
  const [layout, setLayout] = useState();
  const progress = useSharedValue(0);
  const isAnimationReady = Boolean(speed && layout?.width && layout?.height);

  useEffect(() => {
    if (!isAnimationReady) return;
    progress.value = withRepeat(
      withTiming(1, {
        duration: speed,
        easing: Easing.ease,
      }),
      -1,
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
      transform: [{translateX}],
    };
  });

  const placeholders = useMemo(() => {
    if (!enabled) return null;
    return (
      <View style={styles.placeholderContainer}>
        {transformToPlaceholder(children, backgroundColor, borderRadius)}
      </View>
    );
  }, [backgroundColor, children, borderRadius, enabled]);

  const transparentColor = useMemo(
    () => getTransparentColor(highlightColor.replace(/ /g, '')),
    [highlightColor],
  );

  if (!enabled || !placeholders) return children;

  if (!layout?.width || !layout.height)
    return (
      <View onLayout={event => setLayout(event.nativeEvent.layout)}>
        {placeholders}
      </View>
    );

  return (
    <MaskedView
      style={{height: layout.height, width: layout.width}}
      maskElement={placeholders}>
      <View style={[StyleSheet.absoluteFill, {backgroundColor}]} />
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

SkeletonPlaceholder.Item = props => (
  <View style={{width: '100%', height: 500}}>{props.children}</View>
);
SkeletonPlaceholder.Item.displayName = 'SkeletonPlaceholderItem';

const getGradientProps = width => ({
  start: {x: 0, y: 0},
  end: {x: 1, y: 0},
  style: {...StyleSheet.absoluteFillObject, width},
});

const getItemStyle = ({children: _, style, ...styleFromProps}) => {
  return style ? [style, styleFromProps] : styleFromProps;
};

const transformToPlaceholder = (rootElement, backgroundColor, radius) => {
  if (!rootElement) return null;

  return Children.map(rootElement, (element, index) => {
    if (!element) return null;

    if (element.type === Fragment) {
      return (
        <>
          {transformToPlaceholder(
            element.props?.children,
            backgroundColor,
            radius,
          )}
        </>
      );
    }

    const isPlaceholder =
      !element.props?.children ||
      typeof element.props.children === 'string' ||
      (Array.isArray(element.props.children) &&
        element.props.children.every(x => x == null || typeof x === 'string'));

    const props = element.props;
    const style =
      element.type?.displayName === SkeletonPlaceholder.Item.displayName
        ? getItemStyle(element.props)
        : element.props.style;

    const borderRadius = props?.borderRadius ?? style?.borderRadius ?? radius;
    const width = props?.width ?? style?.width;
    const height =
      props?.height ??
      style?.height ??
      props?.lineHeight ??
      style?.lineHeight ??
      props?.fontSize ??
      style?.fontSize;

    const finalStyle = [
      style,
      isPlaceholder
        ? [styles.placeholder, {backgroundColor}]
        : styles.placeholderContainer,
      {height, width, borderRadius},
    ];

    logEnabled &&
      console.log(
        isPlaceholder ? '[skeleton] placeholder' : '[skeleton] container',
        {element},
      );

    return (
      <View
        key={index}
        style={finalStyle}
        children={
          isPlaceholder
            ? undefined
            : transformToPlaceholder(
                element.props.children,
                backgroundColor,
                borderRadius,
              )
        }
      />
    );
  });
};

const styles = StyleSheet.create({
  placeholderContainer: {
    backgroundColor: 'transparent',
  },
  placeholder: {
    overflow: 'hidden',
  },
});

export default SkeletonPlaceholder;

const getColorType = color => {
  if (
    new RegExp(
      /^rgba\((0|255|25[0-4]|2[0-4]\d|1\d\d|0?\d?\d),(0|255|25[0-4]|2[0-4]\d|1\d\d|0?\d?\d),(0|255|25[0-4]|2[0-4]\d|1\d\d|0?\d?\d),(0|0?\.\d|1(\.0)?)\)$/,
    ).test(color)
  )
    return 'rgba';
  if (
    new RegExp(
      /^rgb\((0|255|25[0-4]|2[0-4]\d|1\d\d|0?\d?\d),(0|255|25[0-4]|2[0-4]\d|1\d\d|0?\d?\d),(0|255|25[0-4]|2[0-4]\d|1\d\d|0?\d?\d)\)$/,
    ).test(color)
  )
    return 'rgb';
  if (new RegExp(/^#?([a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i).test(color))
    return 'hex';

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
