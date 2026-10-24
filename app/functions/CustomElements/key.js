import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '.';
import { useState } from 'react';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useTranslation } from 'react-i18next';
import ThemeIcon from './themeIcon';
import { useInSheet } from './redesign/sheetSurface';

export default function KeyForKeyboard({
  num,
  addPin,
  isDot,
  frompage,
  redesign = false,
  fillCell = false,
}) {
  const { tokens } = useGlobalThemeContext();
  const inSheet = useInSheet();
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
          {
            backgroundColor: isPressed
              ? inSheet
                ? tokens.surface
                : tokens.disc
              : inSheet
              ? tokens.disc
              : tokens.surface,
          },
        ],
        fillCell && styles.keyFillCell,
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
        {isDot &&
          frompage !== 'sendSMSPage' &&
          (redesign ? (
            <ThemeText
              styles={[styles.keyText, styles.keyTextRedesign]}
              content="."
            />
          ) : (
            <ThemeIcon colorOverride={tokens.ink} size={60} iconName="Dot" />
          ))}
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
  keyFillCell: { width: '100%', flex: 0, minHeight: 54 },
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
