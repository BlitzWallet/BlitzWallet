import { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import CustomScrollView from '../../../functions/CustomElements/scrollView';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ThemeText } from '../../../functions/CustomElements';
import ThemeIcon from '../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../hooks/themeColors';
import { FONT } from '../../../constants/theme';
import Disc from './Disc';

const ANIMATION_DURATION = 250;

export default function InfoDropdown({
  title = '',
  icon = '',
  infoComponenet,
}) {
  const { backgroundOffset, tokens } = GetThemeColors();
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(275);

  const expandProgress = useSharedValue(0);
  const chevronRotation = useSharedValue(0);

  const toggleExpanded = useCallback(() => {
    const next = !isExpanded;
    setIsExpanded(next);
    expandProgress.value = withTiming(next ? 1 : 0, {
      duration: ANIMATION_DURATION,
    });
    chevronRotation.value = withTiming(next ? 1 : 0, {
      duration: ANIMATION_DURATION,
    });
  }, [isExpanded]);

  const contentStyle = useAnimatedStyle(() => ({
    height: expandProgress.value * contentHeight,
    opacity: expandProgress.value,
    overflow: 'hidden',
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
  }));

  return (
    <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={toggleExpanded}
        style={styles.headerRow}
      >
        <Disc icon={icon} />
        <ThemeText styles={styles.headerTitle} content={title} />
        <Animated.View style={chevronStyle}>
          <ThemeIcon
            redesign
            iconName="ChevronDown"
            size={20}
            colorOverride={tokens.muted}
          />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={contentStyle}>
        <CustomScrollView
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        >
          <View
            onLayout={e => {
              console.log(e.nativeEvent.layout.height, 'content height,dd');
              setContentHeight(Math.round(e.nativeEvent.layout.height));
            }}
            style={styles.contentContainer}
          >
            {infoComponenet}
          </View>
        </CustomScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginTop: 10,
    marginBottom: 16,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONT.Title_Regular,
    marginLeft: 12,
    includeFontPadding: false,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
