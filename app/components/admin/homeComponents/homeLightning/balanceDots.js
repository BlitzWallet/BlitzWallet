import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { COLORS } from '../../../../constants';

const Dot = ({ scrollX, index, screenWidth, theme, darkModeType }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const progress = scrollX.value / screenWidth;

    const opacity = interpolate(
      progress,
      [index - 1, index, index + 1],
      [0.35, 1, 0.35],
      'clamp',
    );

    const width = interpolate(
      progress,
      [index - 1, index, index + 1],
      [5, 18, 5],
      'clamp',
    );

    const borderRadius = interpolate(
      progress,
      [index - 1, index, index + 1],
      [2.5, 3, 2.5],
      'clamp',
    );

    return { opacity, width, borderRadius };
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
    marginTop: 8,
    paddingBottom: 32,
  },

  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginHorizontal: 2.5,
  },

  balanceLabel: {
    textTransform: 'uppercase',
    marginBottom: 8,
  },
});
