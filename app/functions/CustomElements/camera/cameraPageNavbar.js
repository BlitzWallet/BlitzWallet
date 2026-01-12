import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { memo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ICONS } from '../../../constants';
import ThemeImage from '../themeImage';
import { COLORS, WINDOWWIDTH } from '../../../constants/theme';
import { useGlobalInsets } from '../../../../context-store/insetsProvider';
import ThemeIcon from '../themeIcon';

export const CameraPageNavBar = memo(
  ({ showWhiteImage, useFullWidth = true }) => {
    const navigation = useNavigation();

    const { topPadding } = useGlobalInsets();

    const handleGoBack = () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    };

    return (
      <View
        style={{
          ...styles.container,
          top: topPadding,
          width: useFullWidth ? '100%' : WINDOWWIDTH,
        }}
      >
        <TouchableOpacity
          style={styles.topBar}
          activeOpacity={0.5}
          onPress={handleGoBack}
        >
          <ThemeIcon
            colorOverride={showWhiteImage ? COLORS.darkModeText : undefined}
            iconName={'ArrowLeft'}
          />
        </TouchableOpacity>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 99,
    alignSelf: 'center',
  },
});
