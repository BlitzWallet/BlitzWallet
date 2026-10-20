import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {COLORS} from '../../constants';
import ThemeText from './textTheme';
import {useGlobalThemeContext} from '../../../context-store/theme';

export default function FullLoadingScreen({
  text,
  containerStyles,
  reversed,
  textStyles,
  showLoadingIcon = true,
  size = 'large',
  loadingColor,
  showText = true,
}) {
  const {theme, tokens} = useGlobalThemeContext();
  return (
    <View style={{...styles.container, ...containerStyles}}>
      {showLoadingIcon && (
        <ActivityIndicator
          color={
            loadingColor
              ? loadingColor
              : reversed
              ? theme
                ? COLORS.lightModeText
                : COLORS.darkModeText
              : tokens.ink
          }
          size={size}
        />
      )}
      {showText && (
        <ThemeText styles={{...styles.text, ...textStyles}} content={text} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 10,
  },
});
