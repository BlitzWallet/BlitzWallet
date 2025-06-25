import {StyleSheet, View} from 'react-native';
import {CENTER} from '../../constants/styles';
import {WINDOWWIDTH} from '../../constants/theme';
import GetThemeColors from '../../hooks/themeColors';
import useAppInsets from '../../hooks/useAppInsets';

export default function GlobalThemeView({
  children,
  styles,
  useStandardWidth,
  globalContainerStyles,
}) {
  const {topPadding, bottomPadding} = useAppInsets();
  const {backgroundColor} = GetThemeColors();

  if (useStandardWidth) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: backgroundColor,
          ...globalContainerStyles,
        }}>
        <View
          style={{
            ...referanceStyles.widthContainer,
            paddingTop: topPadding,
            paddingBottom: bottomPadding,
            ...styles,
          }}>
          {children}
        </View>
      </View>
    );
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: backgroundColor,
        paddingTop: topPadding,
        paddingBottom: bottomPadding,
        ...styles,
      }}>
      {children}
    </View>
  );
}

const referanceStyles = StyleSheet.create({
  widthContainer: {
    width: WINDOWWIDTH,
    flex: 1,
    ...CENTER,
  },
});
