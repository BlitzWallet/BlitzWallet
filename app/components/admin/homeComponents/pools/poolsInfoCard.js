import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import { SIZES, FONT } from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';

const ANIMATION_DURATION = 250;

export default function PoolsInfoCard() {
  const { backgroundOffset, textColor } = GetThemeColors();
  const { t } = useTranslation();
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
        <ThemeIcon iconName="Info" size={20} />
        <ThemeText
          styles={styles.headerTitle}
          content={t('wallet.pools.info.title')}
        />
        <Animated.View style={chevronStyle}>
          <ThemeIcon
            iconName="ChevronDown"
            size={18}
            colorOverride={textColor}
          />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={contentStyle}>
        <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false}>
          <View
            onLayout={e => {
              console.log(e.nativeEvent.layout.height, 'content height,dd');
              setContentHeight(Math.round(e.nativeEvent.layout.height));
            }}
            style={styles.contentContainer}
          >
            <ThemeText
              styles={styles.sectionTitle}
              content={t('wallet.pools.info.whatArePools')}
            />
            <ThemeText
              styles={styles.bodyText}
              content={t('wallet.pools.info.whatArePoolsBody')}
            />

            <ThemeText
              styles={styles.sectionTitle}
              content={t('wallet.pools.info.howItWorks')}
            />
            <ThemeText
              styles={styles.bulletText}
              content={t('wallet.pools.info.howStep1')}
            />
            <ThemeText
              styles={styles.bulletText}
              content={t('wallet.pools.info.howStep2')}
            />
            <ThemeText
              styles={styles.bulletText}
              content={t('wallet.pools.info.howStep3')}
            />
            <ThemeText
              styles={styles.bulletText}
              content={t('wallet.pools.info.howStep4')}
            />
          </View>
        </ScrollView>
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
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Medium,
    marginLeft: 10,
    includeFontPadding: false,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: SIZES.smedium,
    fontFamily: FONT.Title_Medium,
    marginTop: 12,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: SIZES.small,
    opacity: 0.8,
    lineHeight: 18,
  },
  bulletText: {
    fontSize: SIZES.small,
    opacity: 0.8,
    lineHeight: 18,
    paddingLeft: 8,
    marginBottom: 2,
  },
  tipText: {
    fontSize: SIZES.small,
    opacity: 0.6,
    fontFamily: FONT.Title_light,
    marginTop: 12,
    lineHeight: 18,
  },
});
