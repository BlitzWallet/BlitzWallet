import { View } from 'react-native';
import { useGlobalThemeContext } from '../../../context-store/theme';
import GetThemeColors from '../../hooks/themeColors';
import ThemeIcon from './themeIcon';

export default function CheckMarkCircle({
  isActive,
  containerSize = 30,
  switchDarkMode = false,
}) {
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor, tokens } = GetThemeColors();
  return (
    <View
      style={{
        height: containerSize + (isActive ? 1 : 0),
        width: containerSize + (isActive ? 1 : 0),
        backgroundColor: isActive
          ? theme
            ? switchDarkMode
              ? backgroundColor
              : backgroundOffset
            : tokens.accent
          : 'transparent',
        borderWidth: 2,
        borderColor: theme
          ? isActive
            ? switchDarkMode
              ? backgroundColor
              : backgroundOffset
            : tokens.ink
          : isActive
          ? tokens.accent
          : tokens.ink,
        borderRadius: containerSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isActive && (
        <ThemeIcon
          colorOverride={tokens.onAccent}
          size={Math.round(containerSize / 1.5)}
          iconName={'Check'}
        />
      )}
    </View>
  );
}
