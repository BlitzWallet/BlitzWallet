import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ThemeImage from './themeImage';
import ThemeText from './textTheme';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONT, ICONS, SIZES, TOPBAR_HEIGHT } from '../../constants';
import { keyboardGoBack } from '../customNavigation';
import ThemeIcon from './themeIcon';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useCallback, useRef } from 'react';

export default function CustomSettingsTopBar({
  containerStyles,
  textStyles,
  label,
  shouldDismissKeyboard,
  showLeftImage,
  leftImageFunction,
  leftImageBlue,
  LeftImageDarkMode,
  leftImageStyles = {},
  customBackFunction,
  customBackColor,
  iconNew = '',
  iconNewColor = undefined,
  badgeCount = 0,
  rightContent,
  centerContent,
}) {
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const lastBackPressRef = useRef(0);

  const handleBackPress = useCallback(() => {
    // Ignore rapid double-taps (600ms window, matching useGuardedNavigation)
    // without permanently latching: multi-mode screens intercept back via a
    // beforeRemove/customBackFunction and need it to fire again on a later press.
    if (Date.now() - lastBackPressRef.current < 500) return;
    lastBackPressRef.current = Date.now();

    if (customBackFunction) {
      customBackFunction();
      return;
    }
    if (shouldDismissKeyboard) {
      keyboardGoBack(navigate);
      return;
    }
    navigate.goBack();
  }, [customBackFunction, shouldDismissKeyboard, navigate]);

  return (
    <View style={{ ...styles.topbar, ...containerStyles }}>
      <View style={styles.sideSlot}>
        <TouchableOpacity onPress={handleBackPress}>
          <ThemeIcon colorOverride={customBackColor} iconName={'ArrowLeft'} />
        </TouchableOpacity>
      </View>
      {centerContent ? (
        <View style={styles.centerSlot}>{centerContent}</View>
      ) : (
        <ThemeText
          CustomNumberOfLines={1}
          CustomEllipsizeMode={'tail'}
          content={label || ''}
          styles={{ ...styles.topBarText, ...textStyles }}
        />
      )}
      <View style={[styles.sideSlot, styles.rightSlot]}>
        {showLeftImage && (
          <View>
            <TouchableOpacity onPress={leftImageFunction}>
              {iconNew ? (
                <ThemeIcon
                  colorOverride={iconNewColor}
                  size={leftImageStyles?.height}
                  iconName={iconNew}
                />
              ) : (
                <ThemeImage
                  styles={{ ...leftImageStyles }}
                  lightsOutIcon={LeftImageDarkMode}
                  darkModeIcon={leftImageBlue}
                  lightModeIcon={leftImageBlue}
                />
              )}
            </TouchableOpacity>
            {badgeCount > 0 && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : COLORS.primary,
                    borderColor:
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : COLORS.primary,
                  },
                ]}
                pointerEvents="none"
              >
                <ThemeText
                  adjustsFontSizeToFit={true}
                  allowFontScaling={true}
                  styles={[
                    styles.badgeText,
                    {
                      color:
                        theme && darkModeType
                          ? COLORS.lightModeText
                          : COLORS.darkModeText,
                    },
                  ]}
                  content={badgeCount}
                />
              </View>
            )}
          </View>
        )}
        {rightContent}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  topbar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    height: TOPBAR_HEIGHT,
  },

  // Both sides are in flow and take an equal share of the width the label leaves
  // behind, which is what keeps the label centered without absolute positioning.
  sideSlot: {
    height: '100%',
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 0,
    minWidth: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rightSlot: { justifyContent: 'flex-end' },

  // Same shrink rules as the label, for screens whose centre is a control rather
  // than text (a picker, a cross-fading title).
  centerSlot: {
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  topBarText: {
    fontSize: SIZES.large,
    fontFamily: FONT.Title_Regular,
    textAlign: 'center',
    flexShrink: 1,
    // Yoga gives flex items minWidth 0; CSS gives them `auto`. Without this the
    // label won't shrink on web and shoves the slots off the bar instead.
    minWidth: 0,
    includeFontPadding: false,
  },

  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,

    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: SIZES.small,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
});
