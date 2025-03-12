import {
  Keyboard,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import ThemeImage from './themeImage';
import ThemeText from './textTheme';
import {useNavigation} from '@react-navigation/native';
import {CENTER, FONT, ICONS, SIZES} from '../../constants';
import {keyboardGoBack} from '../customNavigation';

export default function CustomSettingsTopBar({
  containerStyles,
  textStyles,
  label,
  shouldDismissKeyboard,
  showLeftImage,
  leftImageFunction,
  leftImageBlue,
  LeftImageDarkMode,
  customBackFunction,
}) {
  const navigate = useNavigation();
  const windowWidth = useWindowDimensions().width;
  return (
    <View style={{...styles.topbar, ...containerStyles}}>
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
        }}>
        <ThemeImage
          lightsOutIcon={ICONS.arrow_small_left_white}
          darkModeIcon={ICONS.smallArrowLeft}
          lightModeIcon={ICONS.smallArrowLeft}
        />
      </TouchableOpacity>
      <ThemeText
        CustomNumberOfLines={1}
        CustomEllipsizeMode={'tail'}
        content={label || ''}
        styles={{
          ...styles.topBarText,
          width: windowWidth * 0.95 - 60,
          ...textStyles,
        }}
      />
      {showLeftImage && (
        <TouchableOpacity
          style={{position: 'absolute', top: 0, right: 0, zIndex: 1}}
          onPress={leftImageFunction}>
          <ThemeImage
            lightsOutIcon={LeftImageDarkMode}
            darkModeIcon={leftImageBlue}
            lightModeIcon={leftImageBlue}
          />
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
  },
  backArrow: {position: 'absolute', top: 0, left: 0, zIndex: 1},

  topBarText: {
    fontSize: SIZES.xLarge,
    fontFamily: FONT.Title_Regular,
    textAlign: 'center',
    ...CENTER,
  },
});
