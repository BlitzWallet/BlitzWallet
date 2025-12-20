import { TouchableOpacity, View } from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useMemo } from 'react';
import { COLORS } from '../../constants';

export default function IconNew({
  name,
  size = 30,
  color = '',
  containerStyle,
  onPress,
  disabled = false,
  strokeWidth = 2,
  fill = false,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();

  const iconColor = useMemo(() => {
    if (color) return color;
    return theme && darkModeType ? COLORS.darkModeText : COLORS.primary;
  }, [color, theme, darkModeType]);
  const IconComponent = LucideIcons[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in lucide-react-native`);
    return null;
  }
  let iconElement;
  if (fill) {
    iconElement = (
      <IconComponent
        fill={iconColor}
        size={size}
        color={iconColor}
        strokeWidth={strokeWidth}
      />
    );
  } else {
    iconElement = (
      <IconComponent size={size} color={iconColor} strokeWidth={strokeWidth} />
    );
  }

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={containerStyle}
        activeOpacity={0.7}
      >
        {iconElement}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{iconElement}</View>;
}
