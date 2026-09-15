import React, { memo, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { CENTER } from '../../constants/styles';
import { WINDOWWIDTH } from '../../constants/theme';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { MAX_WEB_CONTENT_WIDTH } from '../../constants';

// Web only: content pages live in a centered, capped column. Overlays
// (half modals, popups, error/confirm screens) do NOT use GlobalThemeView, so
// their full-screen scrims keep covering the entire viewport.
const isWeb = Platform.OS === 'web';

const GlobalThemeView = memo(function GlobalThemeView({
  children,
  styles,
  useStandardWidth,
  globalContainerStyles,
}) {
  const { topPadding, bottomPadding } = useGlobalInsets();
  const { backgroundColor } = GetThemeColors();

  const useStandardWidthOuterStyles = useMemo(() => {
    return {
      flex: 1,
      backgroundColor: backgroundColor,
      ...(isWeb && { alignItems: 'center' }),
      ...globalContainerStyles,
    };
  }, [globalContainerStyles, backgroundColor]);
  const useStandardWidthInnerStyles = useMemo(() => {
    return {
      ...referenceStyles.widthContainer,
      ...(isWeb && { maxWidth: MAX_WEB_CONTENT_WIDTH }),
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

  // Web: keep the themed background full-bleed on the outer view and cap the
  // content on an inner view, so wide viewports get a centered 800px column
  // without leaving unthemed gutters.
  if (isWeb) {
    return (
      <View style={{ flex: 1, backgroundColor, alignItems: 'center' }}>
        <View
          style={{
            width: '100%',
            maxWidth: MAX_WEB_CONTENT_WIDTH,
            paddingTop: topPadding,
            paddingBottom: bottomPadding,
            ...styles,
            flex: 1,
          }}
        >
          {children}
        </View>
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
