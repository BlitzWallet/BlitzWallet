import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Svg, { Circle, Rect, ClipPath, Defs, G, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { createHash } from 'react-native-quick-crypto';
import { COLORS } from '../../../../../constants';

// ─── Constants ────────────────────────────────────────────────────────────────
const SPOKE_COUNTS = [4, 6, 8, 10, 12];

const SPRING_CONFIG = {
  damping: 30,
  stiffness: 220,
  mass: 0.8,
};

// ─── Config derivation ────────────────────────────────────────────────────────
function getBadgeConfig(pubkey) {
  const b = pubkey;

  const spokeCount = SPOKE_COUNTS[b[0] % 5];

  // 2 bits per spoke for 3 heights: 00=short, 01=medium, 10/11=tall
  // We have 32 bytes × 8 bits = 256 bits; need spokeCount×2 bits max (24 bits for 12 spokes)
  const spokeBits = (b[1] << 16) | (b[2] << 8) | b[3]; // 24 bits

  const rotationSteps = b[4] % 16;
  const baseAngle = rotationSteps * (360 / spokeCount / 16);

  const spokes = Array.from({ length: spokeCount }, (_, i) => {
    const bits = (spokeBits >> (i * 2)) & 0b11; // extract 2 bits per spoke
    const height =
      bits === 0b11
        ? 'tall'
        : bits === 0b10
        ? 'medium'
        : bits === 0b01
        ? 'medium'
        : 'short';
    // Remap: 00=short, 01=medium, 10=medium, 11=tall → ~25% short, ~50% medium, ~25% tall
    return {
      angle: baseAngle + i * (360 / spokeCount),
      height,
    };
  });

  return { spokes, spokeCount };
}

// ─── Renderer ─────────────────────────────────────────────────────────────────
function IdenticonCircle({ spokes, size, theme, darkModeType }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  const bgColor = !theme
    ? COLORS.lightModeBackgroundOffset
    : !darkModeType
    ? COLORS.darkModeBackgroundOffset
    : COLORS.lightsOutBackgroundOffset;

  const strokeColor = !theme ? COLORS.lightModeText : COLORS.darkModeText;

  const tallOuterR = r * 0.85; // tall spokes
  const mediumOuterR = r * 0.65; // medium spokes
  const shortOuterR = r * 0.45; // short spokes (just inside ring)
  const hubR = r * 0.1;
  const ringR = r * 0.3;

  const strokeWidthTall = Math.max(2, size * 0.03);
  const strokeWidthMedium = Math.max(1.5, size * 0.03);
  const strokeWidthShort = Math.max(1.5, size * 0.03);

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <ClipPath id="spoke-clip">
          <Circle cx={cx} cy={cy} r={r} />
        </ClipPath>
      </Defs>

      <Circle cx={cx} cy={cy} r={r} fill={bgColor} />

      <G clipPath="url(#spoke-clip)">
        {spokes.map(({ angle, height }, i) => {
          const rad = (angle - 90) * (Math.PI / 180);
          const tipR =
            height === 'tall'
              ? tallOuterR
              : height === 'medium'
              ? mediumOuterR
              : shortOuterR;
          const sw =
            height === 'tall'
              ? strokeWidthTall
              : height === 'medium'
              ? strokeWidthMedium
              : strokeWidthShort;
          const opacity =
            height === 'tall' ? 1 : height === 'medium' ? 0.7 : 0.4;

          const x1 = cx + hubR * Math.cos(rad);
          const y1 = cy + hubR * Math.sin(rad);
          const x2 = cx + tipR * Math.cos(rad);
          const y2 = cy + tipR * Math.sin(rad);

          return (
            <Line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={strokeColor}
              strokeWidth={sw}
              strokeLinecap="round"
              opacity={opacity}
            />
          );
        })}

        <Circle
          cx={cx}
          cy={cy}
          r={ringR}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          opacity={1}
        />

        <Circle cx={cx} cy={cy} r={hubR} fill={bgColor} />
        <Circle cx={cx} cy={cy} r={hubR * 0.55} fill={strokeColor} />
      </G>
    </Svg>
  );
}
/**
 * ContactRingAvatar
 *
 * Default state  → profile image large, identicon badge small (bottom-right)
 * Pressed state  → identicon large, profile image small (bottom-right)
 *
 * The swap is driven by a single `progress` shared value (0 → 1).
 */
export default function ContactRingAvatar({
  contactUUID = '',
  size = 44,
  children,
  onToggle,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();

  const pubkey = useMemo(
    () => createHash('sha256').update(contactUUID).digest(),
    [contactUUID],
  );

  const { spokes } = useMemo(() => getBadgeConfig(pubkey), [pubkey]);

  // 0 = profile primary, badge secondary
  // 1 = identicon primary, profile secondary
  const progress = useSharedValue(0);

  const handlePress = useCallback(() => {
    const next = progress.value > 0.5 ? 0 : 1;
    progress.value = withSpring(next, SPRING_CONFIG);
    onToggle?.(next === 1);
  }, [progress, onToggle]);

  // ─── Sizes ────────────────────────────────────────────────────────────────
  const badgeSize = Math.max(14, Math.round(size * 0.32));
  const overhang = Math.round(badgeSize * 0.22);
  const containerSize = size + overhang;

  // When expanded, the secondary sits bottom-right at `size` dimensions
  const expandedSecondarySize = size;
  // Badge ring/border width
  const borderWidth = Math.min(1.5, badgeSize * 0.1);

  // ─── Animated styles ──────────────────────────────────────────────────────

  // Primary (profile image) — large when progress=0, shrinks to badge when progress=1
  const profileAnimStyle = useAnimatedStyle(() => {
    const sz = interpolate(
      progress.value,
      [0, 1],
      [size, badgeSize],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      progress.value,
      [0, 0.4, 1],
      [1, 0.85, 1],
      Extrapolation.CLAMP,
    );
    const bw = interpolate(
      progress.value,
      [0.2, 0.5, 0.8],
      [0, borderWidth * 0.5, borderWidth],
      Extrapolation.CLAMP,
    );

    return {
      width: sz,
      height: sz,
      borderRadius: sz / 2,
      opacity,
      borderWidth: bw,
    };
  });

  // Secondary (identicon) — small badge when progress=0, large when progress=1
  const identiconAnimStyle = useAnimatedStyle(() => {
    const sz = interpolate(
      progress.value,
      [0, 1],
      [badgeSize, expandedSecondarySize],
      Extrapolation.CLAMP,
    );
    // Badge border fades to 0 when expanded
    const bw = interpolate(
      progress.value,
      [0.2, 0.5, 0.8],
      [borderWidth, borderWidth * 0.5, 0],
      Extrapolation.CLAMP,
    );
    return {
      width: sz,
      height: sz,
      borderRadius: sz / 2,
      borderWidth: bw,
    };
  });

  // Profile wrapper position — when identicon is large, profile moves to bottom-right corner
  const profileWrapperStyle = useAnimatedStyle(() => {
    const right = interpolate(
      progress.value,
      [0, 1],
      [overhang, 0],
      Extrapolation.CLAMP,
    );
    const bottom = interpolate(
      progress.value,
      [0, 1],
      [overhang, 0],
      Extrapolation.CLAMP,
    );
    const zIndex = interpolate(
      progress.value,
      [0.49, 0.51],
      [1, 2],
      Extrapolation.CLAMP,
    );
    return { right, bottom, zIndex };
  });

  // Identicon position — badge corner when small, primary position when large
  const identiconWrapperStyle = useAnimatedStyle(() => {
    const right = interpolate(
      progress.value,
      [0, 1],
      [0, overhang],
      Extrapolation.CLAMP,
    );
    const bottom = interpolate(
      progress.value,
      [0, 1],
      [0, overhang],
      Extrapolation.CLAMP,
    );
    const zIndex = interpolate(
      progress.value,
      [0.49, 0.51],
      [2, 1],
      Extrapolation.CLAMP,
    );
    return { right, bottom, zIndex };
  });

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.container,
        { width: containerSize, height: containerSize },
      ]}
    >
      {/* Profile image — primary by default */}
      <Animated.View
        style={[styles.absolute, profileWrapperStyle]}
        pointerEvents="none"
      >
        <Animated.View
          style={[styles.imageClip, styles.identiconBorder, profileAnimStyle]}
        >
          {children}
        </Animated.View>
      </Animated.View>

      {/* Identicon — badge by default, expands on press */}
      <Animated.View
        style={[styles.absolute, identiconWrapperStyle]}
        pointerEvents="none"
      >
        <Animated.View style={[styles.identiconBorder, identiconAnimStyle]}>
          {/* Re-render at correct size using the animated size */}
          <IdenticonSizeAdaptor
            spokes={spokes}
            size={expandedSecondarySize}
            theme={theme}
            darkModeType={darkModeType}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Adapts the SVG size to the current animated size.
 * Uses JS-side state — acceptable because SVG re-render is cheap
 * and this only triggers on press, not every frame.
 */
function IdenticonSizeAdaptor({ spokes, theme, darkModeType, size }) {
  // We pick a fixed size per state — no per-frame JS call needed.
  // The Animated.View handles all the resizing; this just needs to
  // fill its parent, so we render at the larger size and let overflow clip.
  return (
    <View style={{ width: '100%', height: '100%' }}>
      <IdenticonCircle
        spokes={spokes}
        size={size}
        theme={theme}
        darkModeType={darkModeType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  absolute: {
    position: 'absolute',
  },
  imageClip: {
    overflow: 'hidden',
  },
  identiconBorder: {
    overflow: 'hidden',
    borderStyle: 'solid',
    borderColor: COLORS.darkModeText,
  },
});
