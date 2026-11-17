import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import ThemeText from '../../../../../functions/CustomElements/textTheme';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useTheme } from '../../../../../../context-store/theme';
import { FONT } from '../../../../../constants';
import EmptyState from '../../../../../functions/CustomElements/redesign/EmptyState';

export default function SupportMessage({
  type = '',
  statusText = '',
  statusState = null,
}) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { tokens } = useTheme();
  const pending = statusState === 'pending';
  const complete = statusState === 'complete';

  const rotation = useSharedValue(0);
  useEffect(() => {
    if (pending) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false,
      );
    }
  }, [pending, rotation]);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  useEffect(() => {
    if (statusState === 'complete') {
      AccessibilityInfo.announceForAccessibility(
        t('settings.viewAllLiquidSwaps.refundComplete'),
      );
    }
  }, [statusState, t]);

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <EmptyState
          size="large"
          iconTone="ink"
          icon="CircleAlert"
          title={t('settings.viewAllLiquidSwaps.unsupportedTitle', { type })}
          sub={t('settings.viewAllLiquidSwaps.unsupportedDesc', { type })}
        />
      </View>

      {!!statusText && (
        <View
          accessibilityRole="status"
          accessibilityLiveRegion="polite"
          style={styles.statusRow}
        >
          <Animated.View style={!complete ? spinnerStyle : undefined}>
            <ThemeIcon
              redesign
              iconName={complete ? 'Check' : 'LoaderCircle'}
              size={18}
              colorOverride={tokens.ink}
            />
          </Animated.View>
          <ThemeText
            styles={[styles.statusText, { color: tokens.ink }]}
            content={statusText}
          />
        </View>
      )}

      <View style={styles.spacer} />

      <CustomButton
        size="regular"
        tone="primary"
        buttonStyles={styles.button}
        actionFunction={() =>
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'contactUs',
          })
        }
        textContent={t('settings.viewAllLiquidSwaps.contactUs')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  top: {
    marginTop: 120,
  },
  statusRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    textAlign: 'center',
    flexShrink: 1,
  },
  spacer: { flex: 1 },
  button: {
    width: '100%',
  },
});
