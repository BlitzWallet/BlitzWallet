import { StyleSheet, TouchableOpacity } from 'react-native';
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
  loadingColor = COLORS.lightModeText,
  useArrow = false,
  disabled = false,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();

  const memorizedContainerStyles = useMemo(() => {
    // Base styles with theme color
    const baseStyles = {
      ...styles.buttonLocalStyles,
      minWidth: useArrow ? 50 : 120,
    };

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
  }, [buttonStyles]);

  const memorizedTextStyles = useMemo(() => {
    // Base styles with theme color
    const baseStyles = {
      ...styles.text,
      color: theme
        ? darkModeType
          ? COLORS.lightsOutBackground
          : COLORS.darkModeBackground
        : COLORS.lightModeText,
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
  }, [theme, darkModeType, textStyles]);

  return (
    <TouchableOpacity
      disabled={disabled}
      style={memorizedContainerStyles}
      onPress={() => {
        if (useLoading) return;
        actionFunction();
      }}
    >
      {useLoading ? (
        <FullLoadingScreen
          showText={false}
          size="small"
          loadingColor={loadingColor}
        />
      ) : useArrow ? (
        <ThemeIcon
          colorOverride={
            theme && darkModeType
              ? buttonStyles?.backgroundColor
                ? COLORS.darkModeText
                : COLORS.lightModeText
              : undefined
          }
          iconName={'ChevronRight'}
        />
      ) : (
        <ThemeText
          CustomNumberOfLines={1}
          content={textContent}
          styles={memorizedTextStyles}
        />
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
  },
  text: {
    includeFontPadding: false,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  arrowStyles: {
    transform: [{ rotate: '180deg' }],
  },
});
