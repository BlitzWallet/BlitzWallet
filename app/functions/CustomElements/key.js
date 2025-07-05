import {Image, StyleSheet, TouchableOpacity, View} from 'react-native';
import {COLORS, ICONS, SIZES} from '../../constants';
import {ThemeText} from '.';
import {useState} from 'react';
import {backArrow} from '../../constants/styles';
import GetThemeColors from '../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../context-store/theme';

export default function KeyForKeyboard({num, addPin, isDot, frompage}) {
  const {theme} = useGlobalThemeContext();
  const {backgroundOffset} = GetThemeColors();
  const [isPressed, setIsPressed] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={() => {
        if (isDot && frompage === 'sendSMSPage') {
          return;
        }
        setIsPressed(true);
      }}
      onPressOut={() => {
        if (isDot && frompage === 'sendSMSPage') {
          return;
        }
        setTimeout(() => {
          setIsPressed(false);
        }, 200);
      }}
      onPress={() => {
        if (isDot) {
          if (frompage === 'sendSMSPage') return;
          addPin('.');

          return;
        }
        addPin(num === 'back' ? null : num);
      }}
      style={{
        ...styles.key,
      }}>
      <View
        style={{
          ...styles.keyDot,
          backgroundColor: isPressed ? backgroundOffset : 'transparent',
        }}>
        {isDot && frompage != 'sendSMSPage' && (
          <Image
            style={{width: 60, height: 60}}
            source={theme ? ICONS.dotLight : ICONS.dotDark}
          />
        )}

        {!isDot && num === 'back' && (
          <Image
            style={[backArrow]}
            source={theme ? ICONS.leftCheveronLight : ICONS.leftCheveronDark}
          />
        )}
        {!isDot && num != 'back' && (
          <ThemeText
            styles={{
              ...styles.keyText,
              includeFontPadding: false,
            }}
            content={`${num}`}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  key: {
    width: '33.33333333333333%',
    height: 80,
    display: 'flex',
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
  },
});
