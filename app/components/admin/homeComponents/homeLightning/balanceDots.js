import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { COLORS } from '../../../../constants';

const Dot = ({ scrollX, index, screenWidth, theme, darkModeType }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value / screenWidth,
      [index - 1, index, index + 1],
      [0.3, 1, 0.3],
      'clamp',
    );

    const scale = interpolate(
      scrollX.value / screenWidth,
      [index - 1, index, index + 1],
      [0.8, 1.2, 0.8],
      'clamp',
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        animatedStyle,
        {
          backgroundColor:
            theme && darkModeType ? COLORS.darkModeText : COLORS.primary,
        },
      ]}
    />
  );
};

export const BalanceDots = ({
  scrollX,
  pageCount,
  screenWidth,
  theme,
  darkModeType,
}) => {
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: pageCount }).map((_, i) => (
        <Dot
          key={i}
          scrollX={scrollX}
          index={i}
          screenWidth={screenWidth}
          theme={theme}
          darkModeType={darkModeType}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',

    position: 'absolute',
    bottom: 42,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },

  balanceLabel: {
    textTransform: 'uppercase',
    marginBottom: 8,
  },
});
