import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { COLORS } from '../../constants';
import ThemeText from './textTheme';
import CustomButton from './button';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import Animated, {
  useSharedValue,
  withTiming,
  runOnJS,
  useAnimatedStyle,
} from 'react-native-reanimated';
import ThemeIcon from './themeIcon';

export default function InformationPopup(props) {
  const BlurViewAnimation = useSharedValue(0);
  const isInitialLoad = useRef(true);
  const navigate = useNavigation();
  const [goBack, setGoGack] = useState(false);
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor, transparentOveraly } =
    GetThemeColors();
  const {
    route: {
      params: {
        textContent,
        buttonText,
        CustomTextComponent,
        customNavigation,
      },
    },
  } = props;

  useEffect(() => {
    if (isInitialLoad.current) {
      BlurViewAnimation.value = withTiming(1, { duration: 500 });

      isInitialLoad.current = false;
    }
    if (goBack) {
      BlurViewAnimation.value = withTiming(0, { duration: 500 }, isFinished => {
        if (isFinished) {
          if (customNavigation) {
            runOnJS(customNavigation)();
          } else {
            runOnJS(navigate.goBack)();
          }
        }
      });
    }
  }, [goBack]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: BlurViewAnimation.value,
  }));

  return (
    <Animated.View style={[styles.absolute, animatedStyle]}>
      <View style={[styles.container, { backgroundColor: transparentOveraly }]}>
        <View
          style={{
            ...styles.contentContainer,
            backgroundColor: backgroundOffset,
          }}
        >
          <TouchableOpacity
            onPress={() => setGoGack(true)}
            style={{ marginLeft: 'auto', marginBottom: 10 }}
          >
            <ThemeIcon iconName={'X'} />
          </TouchableOpacity>

          {textContent && (
            <ThemeText
              styles={{
                marginBottom: 30,
                textAlign: 'center',
              }}
              content={textContent}
            />
          )}
          {CustomTextComponent && <CustomTextComponent />}
          <CustomButton
            buttonStyles={{
              width: 'auto',
              backgroundColor:
                theme && darkModeType ? backgroundColor : COLORS.primary,
            }}
            textStyles={{
              color: COLORS.darkModeText,
            }}
            textContent={buttonText}
            actionFunction={() => {
              setGoGack(true);
            }}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  absolute: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  contentContainer: {
    width: '70%',
    backgroundColor: COLORS.darkModeText,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
});
