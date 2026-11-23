import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants';
import FullLoadingScreen from './loadingScreen';
import ThemeText from './textTheme';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useMemo } from 'react';
import ThemeIcon from './themeIcon';
import { useInSheet } from './redesign/sheetSurface';

export default function CustomButton({
  buttonStyles,
  textStyles,
  actionFunction,
  textContent,
  useLoading,
  loadingColor,
  useArrow = false,
  disabled = false,
  onTextLayout,
  enableElipsis = true,
  size,
  tone,
  progress,
  icon,
}) {
  const { theme, darkModeType, tokens } = useGlobalThemeContext();
  const isSheet = useInSheet();
  // Redesign pill is opt-in: without size/tone the button renders as today.
  const redesign = !!(size || tone);
  const fill = redesign
    ? tone === 'secondary'
      ? isSheet
        ? tokens.ground
        : tokens.surface
      : tone === 'danger'
      ? tokens.dangerFill
      : tokens.accent
    : null;
  const label = redesign
    ? tone === 'secondary'
      ? tokens.ink
      : tokens.onAccent
    : null;
  // Dimmed (disabled, or a caller passing opacity < 1) = solid colour mixed
  // toward the backdrop, not opacity: opacity lets content behind show through.
  const backdrop = isSheet ? tokens.surface : tokens.ground;
  const callerOpacity = StyleSheet.flatten(buttonStyles)?.opacity;
  const dim =
    callerOpacity < 1 ? callerOpacity : redesign && disabled ? 0.5 : null;

  const memorizedContainerStyles = useMemo(() => {
    // Base styles with theme color
    const baseStyles = redesign
      ? {
          ...styles.pill,
          ...PILL_SIZES[size || 'regular'],
          backgroundColor: fill,
          ...(icon && styles.withIcon),
        }
      : {
          ...styles.buttonLocalStyles,
          minWidth: useArrow ? 50 : 120,
        };
    if (typeof progress === 'number') baseStyles.overflow = 'hidden';

    const merged = !buttonStyles
      ? baseStyles
      : Array.isArray(buttonStyles)
      ? buttonStyles.reduce(
          (acc, style) => ({
            ...acc,
            ...(style || {}),
          }),
          baseStyles,
        )
      : {
          ...baseStyles,
          ...buttonStyles,
        };

    if (dim == null) return merged;
    // Colours we can't mix (rgba, named) keep plain opacity.
    if (!isHex(merged.backgroundColor) || !isHex(backdrop)) {
      return { ...merged, opacity: dim };
    }
    return {
      ...merged,
      opacity: 1,
      backgroundColor: mixHex(merged.backgroundColor, backdrop, dim),
    };
  }, [buttonStyles, redesign, size, fill, dim, backdrop, progress, icon]);

  const memorizedTextStyles = useMemo(() => {
    // Base styles with theme color
    const baseStyles = redesign
      ? { ...styles.pillText, color: label }
      : {
          ...styles.text,
          color: theme ? tokens.ground : tokens.ink,
        };

    const merged = !textStyles
      ? baseStyles
      : Array.isArray(textStyles)
      ? textStyles.reduce(
          (acc, style) => ({
            ...acc,
            ...(style || {}),
          }),
          baseStyles,
        )
      : {
          ...baseStyles,
          ...textStyles,
        };

    // Only when the container was mixed (it already fades text otherwise).
    if (
      dim == null ||
      memorizedContainerStyles.opacity !== 1 ||
      !isHex(merged.color)
    ) {
      return merged;
    }
    return { ...merged, color: mixHex(merged.color, backdrop, dim) };
  }, [
    theme,
    darkModeType,
    tokens,
    textStyles,
    redesign,
    label,
    dim,
    backdrop,
    memorizedContainerStyles,
  ]);

  return (
    <TouchableOpacity
      disabled={disabled}
      style={memorizedContainerStyles}
      onPress={() => {
        if (useLoading) return;
        actionFunction();
      }}
    >
      {typeof progress === 'number' && (
        <View
          pointerEvents="none"
          style={[
            styles.progressFill,
            {
              width: `${Math.min(Math.max(progress, 0), 1) * 100}%`,
              backgroundColor:
                tone === 'secondary' ? tokens.disc : 'rgba(255,255,255,0.24)',
            },
          ]}
        />
      )}
      {useLoading ? (
        <FullLoadingScreen
          showText={false}
          size="small"
          loadingColor={
            loadingColor !== undefined
              ? loadingColor
              : redesign
              ? label
              : COLORS.lightModeText
          }
        />
      ) : useArrow ? (
        <ThemeIcon
          colorOverride={
            theme && darkModeType
              ? buttonStyles?.backgroundColor
                ? tokens.ink
                : COLORS.lightModeText
              : undefined
          }
          iconName={'ChevronRight'}
        />
      ) : (
        <>
          {redesign && !!icon && (
            <ThemeIcon
              redesign
              iconName={icon}
              size={20}
              colorOverride={label}
            />
          )}
          <ThemeText
            onTextLayout={onTextLayout}
            CustomNumberOfLines={enableElipsis ? 1 : undefined}
            content={textContent}
            styles={memorizedTextStyles}
          />
        </>
      )}
    </TouchableOpacity>
  );
}

const isHex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

// Solid equivalent of colour `a` at `alpha` opacity over `b` (#RRGGBB).
function mixHex(a, b, alpha) {
  const ch = (h, i) => parseInt(h.slice(i, i + 2), 16);
  return (
    '#' +
    [1, 3, 5]
      .map(i =>
        Math.round(ch(a, i) * alpha + ch(b, i) * (1 - alpha))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

const styles = StyleSheet.create({
  buttonLocalStyles: {
    minWidth: 120,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.darkModeText,
    cursor: 'pointer',
  },
  text: {
    includeFontPadding: false,
    width: '100%',
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
    cursor: 'pointer',
  },
  withIcon: { flexDirection: 'row', gap: 8 },
  pillText: {
    fontSize: 16,
    lineHeight: 22,
    includeFontPadding: false,
    textAlign: 'center',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
});

// audit/SHARED_FINDINGS.md I.3: regular/compact are full width; small/fit hug
// their content.
const PILL_SIZES = {
  regular: { minHeight: 52, width: '100%' },
  compact: { minHeight: 44, width: '100%' },
  small: { minHeight: 44, alignSelf: 'center' },
  fit: { minHeight: 52, alignSelf: 'center' },
  fill: { minHeight: 52, width: '100%', flexShrink: 1 },
};
