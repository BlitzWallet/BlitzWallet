import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {memo} from 'react';
import {useNavigation} from '@react-navigation/native';
import {ICONS} from '../../../constants';
import ThemeImage from '../themeImage';
import {WINDOWWIDTH} from '../../../constants/theme';
import useAppInsets from '../../../hooks/useAppInsets';

export const CameraPageNavBar = memo(
  ({showWhiteImage, useFullWidth = true}) => {
    const navigation = useNavigation();
    const {topPadding} = useAppInsets();

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
