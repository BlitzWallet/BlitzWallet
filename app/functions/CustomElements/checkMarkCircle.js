import {View} from 'react-native';
import {useGlobalThemeContext} from '../../../context-store/theme';
import GetThemeColors from '../../hooks/themeColors';
import {COLORS} from '../../constants';
import Icon from './Icon';

export default function CheckMarkCircle({isActive, containerSize = 30}) {
  const {theme} = useGlobalThemeContext();
  const {backgroundOffset} = GetThemeColors();
  return (
    <View
      style={{
        height: containerSize,
        width: containerSize,
        backgroundColor: isActive
          ? theme
            ? backgroundOffset
            : COLORS.primary
          : 'transparent',
        borderWidth: isActive ? 0 : 2,
        borderColor: theme ? backgroundOffset : COLORS.white,
        borderRadius: containerSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {isActive && (
        <Icon
          width={containerSize / 2}
          height={containerSize / 2}
          color={COLORS.darkModeText}
          name={'expandedTxCheck'}
        />
      )}
    </View>
  );
}
