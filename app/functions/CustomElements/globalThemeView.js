import {Platform, StyleSheet, View} from 'react-native';
import {useGlobalContextProvider} from '../../../context-store/context';
import {COLORS} from '../../constants';
import {ANDROIDSAFEAREA, CENTER} from '../../constants/styles';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {WINDOWWIDTH} from '../../constants/theme';
import GetThemeColors from '../../hooks/themeColors';

export default function GlobalThemeView({
  children,
  styles,
  useStandardWidth,
  globalContainerStyles,
}) {
  const insets = useSafeAreaInsets();
  const {backgroundColor} = GetThemeColors();

  const topPadding = Platform.select({
    ios: insets.top,
    android: ANDROIDSAFEAREA,
  });

  const bottomPadding = Platform.select({
    ios: insets.bottom,
    android: ANDROIDSAFEAREA,
  });

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
