import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import {COLORS, FONT, SIZES} from '../../constants';
import FullLoadingScreen from './loadingScreen';
import ThemeText from './textTheme';
import {useGlobalThemeContext} from '../../../context-store/theme';

export default function CustomButton({
  buttonStyles,
  textStyles,
  actionFunction,
  textContent,
  useLoading,
  loadingColor = COLORS.lightModeText,
}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  return (
    <TouchableOpacity
      style={{
        ...styles.buttonLocalStyles,
        backgroundColor: COLORS.darkModeText,
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
});
