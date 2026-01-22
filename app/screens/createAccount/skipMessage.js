import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants';
import { ThemeText } from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MAX_CONTENT_WIDTH } from '../../constants/theme';
import GetThemeColors from '../../hooks/themeColors';
import ThemeIcon from '../../functions/CustomElements/themeIcon';

export default function SkipCreateAccountPathMessage() {
  const { transparentOveraly } = GetThemeColors();
  const blurViewAnimation = useSharedValue(0);
  const isInitialLoad = useRef(true);
  const navigate = useNavigation();
  const [goBack, setGoGack] = useState(false);
  const goToPinRef = useRef(false);
  const { t } = useTranslation();

  const handleBackPressFunction = () => {
    setGoGack(true);
    return true;
  };
  useHandleBackPressNew(handleBackPressFunction);

  useEffect(() => {
    if (isInitialLoad.current) {
      blurViewAnimation.value = withTiming(1, { duration: 500 });
      isInitialLoad.current = false;
    }
    if (goBack) {
      blurViewAnimation.value = withTiming(0, { duration: 500 }, isFinished => {
        if (isFinished) {
          runOnJS(navigate.goBack)();
          if (goToPinRef.current) {
            runOnJS(navigate.navigate)('PinSetup', { isInitialLoad: true });
          }
        }
      });
    }
  }, [goBack]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: blurViewAnimation.value,
  }));

  return (
    <Animated.View style={[styles.absolute, animatedStyle]}>
      <View style={[styles.container, { backgroundColor: transparentOveraly }]}>
        <View style={styles.contentContainer}>
          <TouchableOpacity
            onPress={() => setGoGack(true)}
            style={{ marginLeft: 'auto', marginBottom: 10 }}
          >
            <ThemeIcon iconName={'X'} />
          </TouchableOpacity>

          <ThemeText
            styles={{ marginBottom: 20, textAlign: 'center' }}
            content={t('createAccount.skipMessage.header')}
          />
          <ThemeText
            styles={{ marginBottom: 30, textAlign: 'center' }}
            content={t('createAccount.skipMessage.subHeader')}
          />
          <CustomButton
            buttonStyles={{
              width: 'auto',
              backgroundColor: COLORS.primary,
            }}
            textStyles={{
              color: COLORS.darkModeText,
            }}
            textContent={t('createAccount.skipMessage.btn')}
            actionFunction={() => {
              setGoGack(true);
              goToPinRef.current = true;
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
    maxWidth: MAX_CONTENT_WIDTH,
    backgroundColor: COLORS.darkModeText,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
});
