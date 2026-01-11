import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS, SIZES } from '../../constants';
import { ThemeText } from '.';
import { useState } from 'react';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import ThemeIcon from './themeIcon';

export default function KeyForKeyboard({ num, addPin, isDot, frompage }) {
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset, textColor } = GetThemeColors();
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = () => {
    if (isDot && frompage === 'sendSMSPage') return;

    addPin(isDot ? '.' : num === 'back' ? null : num);
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={() =>
        isDot && frompage === 'sendSMSPage' ? null : setIsPressed(true)
      }
      onPressOut={() =>
        isDot && frompage === 'sendSMSPage'
          ? null
          : setTimeout(() => setIsPressed(false), 200)
      }
      onPress={handlePress}
      style={styles.key}
    >
      <View
        style={[
          styles.keyDot,
          { backgroundColor: isPressed ? backgroundOffset : 'transparent' },
        ]}
      >
        {isDot && frompage !== 'sendSMSPage' && (
          <ThemeIcon colorOverride={textColor} size={60} iconName={'Dot'} />
        )}
        {!isDot &&
          (num === 'back' ? (
            <ThemeIcon colorOverride={textColor} iconName={'ChevronLeft'} />
          ) : (
            <ThemeText styles={styles.keyText} content={`${num}`} />
          ))}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  key: {
    width: '33.333333%',
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDot: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  keyText: {
    fontSize: SIZES.xLarge,
    includeFontPadding: false,
  },
});
