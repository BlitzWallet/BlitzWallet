import { StyleSheet, TouchableOpacity, View } from 'react-native';
import ThemeImage from './themeImage';
import ThemeText from './textTheme';
import { useNavigation } from '@react-navigation/native';
import { CENTER, FONT, ICONS, SIZES } from '../../constants';
import { keyboardGoBack } from '../customNavigation';
import { useAppStatus } from '../../../context-store/appStatus';
import ThemeIcon from './themeIcon';

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
}) {
  const { screenDimensions } = useAppStatus();
  const navigate = useNavigation();
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
        <TouchableOpacity
          style={{
            position: 'absolute',
            right: 0,
            zIndex: 1,
          }}
          onPress={leftImageFunction}
        >
          {iconNew ? (
            <ThemeIcon size={leftImageStyles?.height} iconName={iconNew} />
          ) : (
            <ThemeImage
              styles={{ ...leftImageStyles }}
              lightsOutIcon={LeftImageDarkMode}
              darkModeIcon={leftImageBlue}
              lightModeIcon={leftImageBlue}
            />
          )}
        </TouchableOpacity>
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
});
