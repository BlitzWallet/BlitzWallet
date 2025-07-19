import React, {memo, useMemo} from 'react';
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
  const useStandardWidthOuterStyles = useMemo(() => {
    return {
      flex: 1,
      backgroundColor: backgroundColor,
      ...globalContainerStyles,
    };
  }, [globalContainerStyles, backgroundColor]);
  const useStandardWidthInnerStyles = useMemo(() => {
    return {
      ...referenceStyles.widthContainer,
      paddingTop: topPadding,
      paddingBottom: bottomPadding,
      ...styles,
    };
  }, [referenceStyles, styles, topPadding, bottomPadding]);

  const nonStandardWithStyles = useMemo(() => {
    return {
      flex: 1,
      backgroundColor: backgroundColor,
      paddingTop: topPadding,
      paddingBottom: bottomPadding,
      ...styles,
    };
  }, [backgroundColor, styles, topPadding, bottomPadding]);

  if (useStandardWidth) {
    return (
      <View style={useStandardWidthOuterStyles}>
        <View style={useStandardWidthInnerStyles}>{children}</View>
      </View>
    );
  }

  return <View style={nonStandardWithStyles}>{children}</View>;
});

const referenceStyles = StyleSheet.create({
  widthContainer: {
    width: WINDOWWIDTH,
    flex: 1,
    ...CENTER,
  },
});

export default GlobalThemeView;
