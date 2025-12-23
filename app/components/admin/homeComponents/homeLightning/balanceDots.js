import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { COLORS } from '../../../../constants';

export const BalanceDots = ({ scrollX, pageCount, screenWidth }) => {
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: pageCount }).map((_, i) => {
        const animatedStyle = useAnimatedStyle(() => {
          const opacity = interpolate(
            scrollX.value / screenWidth,
            [i - 1, i, i + 1],
            [0.3, 1, 0.3],
            'clamp',
          );

          const scale = interpolate(
            scrollX.value / screenWidth,
            [i - 1, i, i + 1],
            [0.8, 1.2, 0.8],
            'clamp',
          );

          return {
            opacity,
            transform: [{ scale }],
          };
        });

        return <Animated.View key={i} style={[styles.dot, animatedStyle]} />;
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    paddingBottom: 22,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginHorizontal: 4,
  },

  balanceLabel: {
    textTransform: 'uppercase',
    marginBottom: 8,
  },
});
