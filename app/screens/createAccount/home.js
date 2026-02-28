import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { CENTER, COLORS, SIZES } from '../../constants';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import { createAccountMnemonic } from '../../functions';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../functions/crashlyticsLogs';
import { useKeysContext } from '../../../context-store/keys';
import {
  FONT,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../constants/theme';
import { useAppStatus } from '../../../context-store/appStatus';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const BOX_STROKE = '#D8DCE3';

// ─── Box-grid SVG background ──────────────────────────────────────────────────
function BoxGrid({ W, H }) {
  const BOX = 52;
  const GAP = 0;
  const STEP = BOX + GAP;
  const cols = Math.ceil(W / STEP) + 1;
  const rows = Math.ceil(H / STEP) + 1;

  const boxes = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      boxes.push({ x: c * STEP, y: r * STEP, key: `${r}-${c}` });
    }
  }

  return (
    <Svg
      width={W}
      height={H}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop
            offset="0%"
            stopColor={COLORS.lightModeBackground}
            stopOpacity="0"
          />
          <Stop
            offset="68%"
            stopColor={COLORS.lightModeBackground}
            stopOpacity="0"
          />
          <Stop
            offset="100%"
            stopColor={COLORS.lightModeBackground}
            stopOpacity="1"
          />
        </LinearGradient>
      </Defs>

      {boxes.map(b => (
        <Rect
          key={b.key}
          x={b.x}
          y={b.y}
          width={BOX}
          height={BOX}
          fill={COLORS.lightModeBackground}
          stroke={BOX_STROKE}
          strokeWidth={0.8}
        />
      ))}

      <Rect x={0} y={0} width={W} height={H} fill="url(#fade)" />
    </Svg>
  );
}

// ─── Easing config ────────────────────────────────────────────────────────────
const easeOut = Easing.out(Easing.cubic);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CreateAccountHome({ navigation: { navigate } }) {
  const { t } = useTranslation();
  const { setAccountMnemonic } = useKeysContext();
  const { screenDimensions } = useAppStatus();

  // Shared values
  const logoOpacity = useSharedValue(0);
  const headingOpacity = useSharedValue(0);
  const headingY = useSharedValue(24);
  const btnsOpacity = useSharedValue(0);

  // Animated styles
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
  }));

  const headingStyle = useAnimatedStyle(() => ({
    opacity: headingOpacity.value,
    transform: [{ translateY: headingY.value }],
  }));

  const btnsStyle = useAnimatedStyle(() => ({
    opacity: btnsOpacity.value,
  }));

  useEffect(() => {
    // Sequence: logo → heading → buttons
    logoOpacity.value = withTiming(1, { duration: 480, easing: easeOut });

    headingOpacity.value = withDelay(
      480,
      withTiming(1, { duration: 520, easing: easeOut }),
    );
    headingY.value = withDelay(
      480,
      withTiming(0, { duration: 520, easing: easeOut }),
    );

    btnsOpacity.value = withDelay(
      1000,
      withTiming(1, { duration: 400, easing: easeOut }),
    );
  }, []);

  useEffect(() => {
    (async () => {
      try {
        crashlyticsLogReport('Creating account mnemonic');
        const mnemonic = await createAccountMnemonic();
        setAccountMnemonic(mnemonic);
      } catch (err) {
        crashlyticsRecordErrorReport(err.message);
      }
    })();
  }, []);

  const go = (page, nextPage) => {
    crashlyticsLogReport(`Navigating to ${page} from create account home`);
    navigate(page, { nextPage });
  };

  return (
    <GlobalThemeView>
      <BoxGrid W={screenDimensions.width} H={screenDimensions.height} />

      <View style={styles.container}>
        {/* ── Headline ── */}
        <Animated.View style={[styles.heroWrap, headingStyle]}>
          <ThemeText
            styles={styles.headline}
            content={t('createAccount.homePage.money')}
            isLight={true}
          />
          <ThemeText
            styles={styles.headline}
            content={t('createAccount.homePage.made')}
            isLight={true}
          />
          <ThemeText
            styles={[styles.headline, { color: COLORS.primary }]}
            content={t('createAccount.homePage.simple')}
            isLight={true}
          />
        </Animated.View>

        <View style={styles.spacer} />

        {/* ── CTAs ── */}
        <Animated.View style={[styles.ctaSection, btnsStyle]}>
          <CustomButton
            buttonStyles={styles.primaryBtn}
            textStyles={styles.primaryBtnText}
            textContent={t('createAccount.homePage.buttons.button2')}
            actionFunction={() => go('DisclaimerPage', 'PinSetup')}
          />

          <CustomButton
            buttonStyles={styles.secondaryBtn}
            textStyles={styles.secondaryBtnText}
            textContent={t('createAccount.homePage.buttons.button1')}
            actionFunction={() => go('DisclaimerPage', 'RestoreWallet')}
          />

          <ThemeText
            styles={styles.disclaimer}
            content={t('createAccount.homePage.subtitle')}
            isLight={true}
          />
        </Animated.View>
      </View>
    </GlobalThemeView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  heroWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  headline: {
    fontSize: 64,
    fontFamily: FONT.Title_Bold,
    marginVertical: -8,
    letterSpacing: -2.5,
    includeFontPadding: false,
  },
  spacer: { height: 0 },
  ctaSection: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    // fontWeight: '600',
    letterSpacing: 0.1,
  },
  secondaryBtn: {
    width: '100%',
  },
  secondaryBtnText: {
    // fontWeight: '600',
    fontSize: 16,
  },
  disclaimer: {
    fontSize: SIZES.xSmall,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    includeFontPadding: false,
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
