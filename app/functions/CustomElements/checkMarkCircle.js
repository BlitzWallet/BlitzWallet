import {View} from 'react-native';
import {useGlobalThemeContext} from '../../../context-store/theme';
import GetThemeColors from '../../hooks/themeColors';
import {COLORS} from '../../constants';
import Icon from './Icon';

export default function CheckMarkCircle({isActive}) {
  const {theme} = useGlobalThemeContext();
  const {backgroundOffset} = GetThemeColors();
  return (
    <View
      style={{
        height: 30,
        width: 30,
        backgroundColor: isActive
          ? theme
            ? backgroundOffset
            : COLORS.primary
          : 'transparent',
        borderWidth: isActive ? 0 : 2,
        borderColor: theme ? backgroundOffset : COLORS.white,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {isActive && (
        <Icon
          width={15}
          height={15}
          color={COLORS.darkModeText}
          name={'expandedTxCheck'}
        />
      )}
    </View>
  );
}
