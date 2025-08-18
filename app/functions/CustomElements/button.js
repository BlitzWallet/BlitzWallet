import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import {COLORS, FONT, ICONS, SIZES} from '../../constants';
import FullLoadingScreen from './loadingScreen';
import ThemeText from './textTheme';
import {useGlobalThemeContext} from '../../../context-store/theme';
import ThemeImage from './themeImage';

export default function CustomButton({
  buttonStyles,
  textStyles,
  actionFunction,
  textContent,
  useLoading,
  loadingColor = COLORS.lightModeText,
  useArrow = false,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  return (
    <TouchableOpacity
      style={{
        ...styles.buttonLocalStyles,
        backgroundColor: COLORS.darkModeText,
        minWidth: useArrow ? 50 : 120,
        ...buttonStyles,
      }}
      onPress={() => {
        if (useLoading) return;
        actionFunction();
      }}>
      {useLoading ? (
        <FullLoadingScreen
          showText={false}
          size="small"
          loadingColor={loadingColor}
        />
      ) : useArrow ? (
        <ThemeImage
          styles={styles.arrowStyles}
          lightModeIcon={ICONS.leftCheveronIcon}
          darkModeIcon={ICONS.leftCheveronIcon}
          lightsOutIcon={ICONS.leftCheveronDark}
        />
      ) : (
        <ThemeText
          CustomNumberOfLines={1}
          content={textContent}
          styles={{
            ...styles.text,
            color: theme
              ? darkModeType
                ? COLORS.lightsOutBackground
                : COLORS.darkModeBackground
              : COLORS.lightModeText,
            ...textStyles,
          }}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  buttonLocalStyles: {
    minWidth: 120,
    minHeight: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  text: {
    includeFontPadding: false,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  arrowStyles: {
    transform: [{rotate: '180deg'}],
  },
});
