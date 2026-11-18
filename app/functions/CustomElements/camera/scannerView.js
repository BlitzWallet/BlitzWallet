import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../../constants';
import { useGlobalInsets } from '../../../../context-store/insetsProvider';
import ThemeText from '../textTheme';
import ThemeIcon from '../themeIcon';
import GetThemeColors from '../../../hooks/themeColors';

const CHROME = 'rgba(255,255,255,0.16)';
const CORNERS = [
  {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 20,
  },
  {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 20,
  },
  {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 20,
  },
  {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderBottomRightRadius: 20,
    borderRightWidth: 4,
  },
];

// Full-screen scanner shell (System.dc.html "Scan QR"): dark ground, the
// camera (children) fades in over 200 ms, white corner frame + hint, round
// 56 action buttons. `onBack` omitted = no back button (Home camera pager).
// actions: [{ icon, label (en key), onPress, disabled }]
export default function ScannerView({ children, onBack, actions = [], hint }) {
  const { t } = useTranslation();
  const { topPadding, bottomPadding } = useGlobalInsets();
  const { tokens } = GetThemeColors();

  return (
    <View style={styles.container}>
      <Animated.View
        entering={FadeIn.duration(200)}
        style={StyleSheet.absoluteFill}
      >
        {children}
      </Animated.View>

      {!!onBack && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('constants.back')}
          style={[styles.round, styles.back, { top: topPadding + 10 }]}
          onPress={onBack}
        >
          <ThemeIcon
            redesign
            iconName="ArrowLeft"
            size={20}
            colorOverride={COLORS.darkModeText}
          />
        </TouchableOpacity>
      )}

      <View style={styles.center} pointerEvents="none">
        <View style={styles.frame}>
          {CORNERS.map((corner, index) => (
            <View
              key={index}
              style={[styles.corner, corner, { borderColor: tokens.accent }]}
            />
          ))}
        </View>
        {!!hint && (
          <ThemeText variant="body" styles={styles.hint} content={hint} />
        )}
      </View>

      <View style={[styles.actions, { bottom: bottomPadding + 14 }]}>
        {actions.map(action => (
          <TouchableOpacity
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={t(action.label)}
            disabled={action.disabled}
            style={[styles.round, styles.action]}
            onPress={action.onPress}
          >
            <ThemeIcon
              redesign
              iconName={action.icon}
              size={22}
              colorOverride={COLORS.darkModeText}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#121417',
    alignItems: 'center',
    justifyContent: 'center',
  },
  round: {
    backgroundColor: CHROME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    position: 'absolute',
    zIndex: 2,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  center: { alignItems: 'center', paddingHorizontal: 20 },
  frame: { width: 240, height: 240 },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    // borderColor: COLORS.darkModeText,
  },
  hint: {
    color: COLORS.darkModeText,
    marginTop: 24,
    textAlign: 'center',
  },
  actions: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 20,
  },
  action: { width: 56, height: 56, borderRadius: 28 },
});
