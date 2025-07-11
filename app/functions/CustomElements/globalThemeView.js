import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {CENTER} from '../../constants/styles';
import {WINDOWWIDTH} from '../../constants/theme';
import GetThemeColors from '../../hooks/themeColors';
import {useGlobalInsets} from '../../../context-store/insetsProvider';

const GlobalThemeView = memo(function GlobalThemeView({
  children,
  styles,
  useStandardWidth,
  globalContainerStyles,
}) {
  const {topPadding, bottomPadding} = useGlobalInsets();
  const {backgroundColor} = GetThemeColors();

  console.log(topPadding, bottomPadding, 'GLOBAL THEME VIEW');
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
            ...referenceStyles.widthContainer,
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
});

const referenceStyles = StyleSheet.create({
  widthContainer: {
    width: WINDOWWIDTH,
    flex: 1,
    ...CENTER,
  },
});

export default GlobalThemeView;
