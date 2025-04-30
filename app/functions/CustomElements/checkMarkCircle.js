import {View} from 'react-native';
import {useGlobalThemeContext} from '../../../context-store/theme';
import GetThemeColors from '../../hooks/themeColors';
import {COLORS} from '../../constants';
import Icon from './Icon';

export default function CheckMarkCircle({
  isActive,
  containerSize = 30,
  color,
  backgroundColor,
  checkColor,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const {backgroundOffset} = GetThemeColors();
  return (
    <View
      style={{
        height: containerSize,
        width: containerSize,
        backgroundColor: isActive
          ? theme
            ? backgroundColor || backgroundOffset
            : backgroundColor || COLORS.primary
          : 'transparent',
        borderWidth: isActive ? 0 : 2,
        borderColor: theme
          ? color || COLORS.darkModeText
          : color || COLORS.white,
        borderRadius: containerSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {isActive && (
        <Icon
          width={containerSize / 2}
          height={containerSize / 2}
          color={checkColor || COLORS.darkModeText}
          name={'expandedTxCheck'}
        />
      )}
    </View>
  );
}
