import {Platform, StyleSheet, TouchableOpacity, View} from 'react-native';
import {memo} from 'react';
import {useNavigation} from '@react-navigation/native';
import {ICONS} from '../../../constants';
import ThemeImage from '../themeImage';
import {WINDOWWIDTH} from '../../../constants/theme';
import {useGlobalInsets} from '../../../../context-store/insetsProvider';

export const CameraPageNavBar = memo(
  ({showWhiteImage, useFullWidth = true}) => {
    const navigation = useNavigation();

    const {topPadding} = useGlobalInsets();

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
        }}>
        <TouchableOpacity
          style={styles.topBar}
          activeOpacity={0.5}
          onPress={handleGoBack}>
          <ThemeImage
            lightModeIcon={
              showWhiteImage
                ? ICONS.arrow_small_left_white
                : ICONS.smallArrowLeft
            }
            darkModeIcon={
              showWhiteImage
                ? ICONS.arrow_small_left_white
                : ICONS.smallArrowLeft
            }
            lightsOutIcon={ICONS.arrow_small_left_white}
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
