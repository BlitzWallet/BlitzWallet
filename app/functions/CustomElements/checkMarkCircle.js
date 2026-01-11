import { View } from 'react-native';
import { useGlobalThemeContext } from '../../../context-store/theme';
import GetThemeColors from '../../hooks/themeColors';
import { COLORS } from '../../constants';
import ThemeIcon from './themeIcon';

export default function CheckMarkCircle({
  isActive,
  containerSize = 30,
  switchDarkMode = false,
}) {
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  return (
    <View
      style={{
        height: containerSize,
        width: containerSize,
        backgroundColor: isActive
          ? theme
            ? switchDarkMode
              ? backgroundColor
              : backgroundOffset
            : COLORS.primary
          : 'transparent',
        borderWidth: 2,
        borderColor: theme
          ? isActive
            ? switchDarkMode
              ? backgroundColor
              : backgroundOffset
            : COLORS.darkModeText
          : isActive
          ? COLORS.primary
          : COLORS.lightModeText,
        borderRadius: containerSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isActive && (
        <ThemeIcon
          colorOverride={COLORS.darkModeText}
          size={Math.round(containerSize / 1.5)}
          iconName={'Check'}
        />
      )}
    </View>
  );
}
