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

const EXPANDED_HEIGHT = 275;
const ANIMATION_DURATION = 250;

export default function PoolsInfoCard() {
  const { backgroundOffset, textColor } = GetThemeColors();
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

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
    height: expandProgress.value * EXPANDED_HEIGHT,
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
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.contentContainer}>
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

            {/* <ThemeText
            styles={styles.sectionTitle}
            content={t('wallet.pools.info.lifecycle')}
          />
          <ThemeText
            styles={styles.bulletText}
            content={t('wallet.pools.info.lifecycleActive')}
          />
          <ThemeText
            styles={styles.bulletText}
            content={t('wallet.pools.info.lifecycleClosed')}
          /> */}

            {/* <ThemeText
            styles={styles.tipText}
            content={t('wallet.pools.info.tip')}
          /> */}
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
