import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '.';
import { useState } from 'react';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import ThemeIcon from './themeIcon';

export default function KeyForKeyboard({
  num,
  addPin,
  isDot,
  frompage,
  redesign = false,
}) {
  const { tokens } = useGlobalThemeContext();
  const { t } = useTranslation();
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
      accessibilityRole="button"
      accessibilityLabel={
        num === 'back' ? t('constants.delete') : isDot ? '.' : `${num}`
      }
      style={[
        styles.key,
        redesign && [
          styles.keyRedesign,
          { backgroundColor: isPressed ? tokens.disc : tokens.surface },
        ],
      ]}
    >
      <View
        style={[
          styles.keyDot,
          !redesign && {
            backgroundColor: isPressed ? tokens.surface : 'transparent',
          },
        ]}
      >
        {isDot && frompage !== 'sendSMSPage' && (
          <ThemeIcon
            colorOverride={redesign ? tokens.ink : tokens.ink}
            size={redesign ? 8 : 60}
            iconName={redesign ? 'Dot' : 'Dot'}
          />
        )}
        {!isDot &&
          (num === 'back' ? (
            <ThemeIcon
              colorOverride={tokens.ink}
              size={redesign ? 22 : 30}
              iconName={redesign ? 'Delete' : 'ChevronLeft'}
            />
          ) : (
            <ThemeText
              styles={[styles.keyText, redesign && styles.keyTextRedesign]}
              content={`${num}`}
            />
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
  keyRedesign: {
    flex: 1,
    width: 'auto',
    height: 'auto',
    minHeight: 54,
    borderRadius: 999,
    paddingHorizontal: 16,
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
    fontSize: 24,
    includeFontPadding: false,
  },
  keyTextRedesign: {
    fontSize: 24,
    lineHeight: 32,
    includeFontPadding: false,
  },
});
