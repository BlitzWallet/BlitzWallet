import { StyleSheet, View } from 'react-native';
import ThemeIcon from '../CustomElements/themeIcon';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { COLORS } from '../../constants';
import GetThemeColors from '../../hooks/themeColors';

export default function IconActionCircle({
  size = 80,
  icon,
  bottomOffset = 0,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  return (
    <View
      style={[
        styles.iconContainer,
        {
          backgroundColor: backgroundOffset,
          borderColor: backgroundColor,
        },
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          marginBottom: bottomOffset,
        },
      ]}
    >
      <ThemeIcon
        colorOverride={
          theme && darkModeType ? COLORS.darkModeText : COLORS.primary
        }
        iconName={icon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
