import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants';
import FullLoadingScreen from './loadingScreen';
import ThemeText from './textTheme';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useMemo } from 'react';
import ThemeIcon from './themeIcon';

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
  // Redesign pill is opt-in: without size/tone the button renders as today.
  const redesign = !!(size || tone);
  const fill = redesign
    ? tone === 'secondary'
      ? tokens.surface
      : tone === 'danger'
      ? tokens.danger
      : tokens.accent
    : null;
  const label = redesign
    ? tone === 'secondary'
      ? tokens.ink
      : tokens.onAccent
    : null;

  const memorizedContainerStyles = useMemo(() => {
    // Base styles with theme color
    const baseStyles = redesign
      ? {
          ...styles.pill,
          ...PILL_SIZES[size || 'regular'],
          backgroundColor: fill,
          opacity: disabled ? 0.5 : 1,
          ...(icon && styles.withIcon),
        }
      : {
          ...styles.buttonLocalStyles,
          minWidth: useArrow ? 50 : 120,
        };
    if (typeof progress === 'number') baseStyles.overflow = 'hidden';

    if (!buttonStyles) {
      return baseStyles;
    }

    if (Array.isArray(buttonStyles)) {
      return buttonStyles.reduce(
        (acc, style) => ({
          ...acc,
          ...(style || {}),
        }),
        baseStyles,
      );
    }

    return {
      ...baseStyles,
      ...buttonStyles,
    };
  }, [buttonStyles, redesign, size, fill, disabled, progress, icon]);

  const memorizedTextStyles = useMemo(() => {
    // Base styles with theme color
    const baseStyles = redesign
      ? { ...styles.pillText, color: label }
      : {
          ...styles.text,
          color: theme ? tokens.ground : tokens.ink,
        };

    if (!textStyles) {
      return baseStyles;
    }

    if (Array.isArray(textStyles)) {
      return textStyles.reduce(
        (acc, style) => ({
          ...acc,
          ...(style || {}),
        }),
        baseStyles,
      );
    }

    return {
      ...baseStyles,
      ...textStyles,
    };
  }, [theme, darkModeType, tokens, textStyles, redesign, label]);

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
  arrowStyles: {
    transform: [{ rotate: '180deg' }],
  },
});

// audit/SHARED_FINDINGS.md I.3: regular/compact are full width; small/fit hug
// their content.
const PILL_SIZES = {
  regular: { minHeight: 52, width: '100%' },
  compact: { minHeight: 44, width: '100%' },
  small: { minHeight: 44, alignSelf: 'center' },
  fit: { minHeight: 52, alignSelf: 'center' },
};
