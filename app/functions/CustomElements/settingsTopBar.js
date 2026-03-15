import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ThemeImage from './themeImage';
import ThemeText from './textTheme';
import { useNavigation } from '@react-navigation/native';
import { CENTER, COLORS, FONT, ICONS, SIZES } from '../../constants';
import { keyboardGoBack } from '../customNavigation';
import { useAppStatus } from '../../../context-store/appStatus';
import ThemeIcon from './themeIcon';
import { useGlobalThemeContext } from '../../../context-store/theme';

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
}) {
  const { screenDimensions } = useAppStatus();
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();

  return (
    <View style={{ ...styles.topbar, ...containerStyles }}>
      <TouchableOpacity
        style={styles.backArrow}
        onPress={() => {
          if (customBackFunction) {
            customBackFunction();
            return;
          }
          if (shouldDismissKeyboard) {
            keyboardGoBack(navigate);
            return;
          }
          navigate.goBack();
        }}
      >
        <ThemeIcon colorOverride={customBackColor} iconName={'ArrowLeft'} />
      </TouchableOpacity>
      <ThemeText
        CustomNumberOfLines={1}
        CustomEllipsizeMode={'tail'}
        content={label || ''}
        styles={{
          ...styles.topBarText,
          width: screenDimensions.width * 0.95 - 60,
          ...textStyles,
        }}
      />
      {showLeftImage && (
        <View style={{ position: 'absolute', right: 0, zIndex: 1 }}>
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
    </View>
  );
}
const styles = StyleSheet.create({
  topbar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 10,
    minHeight: 30,
  },
  backArrow: { position: 'absolute', left: 0, zIndex: 1 },

  topBarText: {
    fontSize: SIZES.large,
    fontFamily: FONT.Title_Regular,
    textAlign: 'center',
    ...CENTER,
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
