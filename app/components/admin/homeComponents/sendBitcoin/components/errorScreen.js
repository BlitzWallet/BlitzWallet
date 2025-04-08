import {ScrollView, StyleSheet, useWindowDimensions} from 'react-native';
import LottieView from 'lottie-react-native';
import CustomButton from '../../../../../functions/CustomElements/button';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {CENTER, SIZES} from '../../../../../constants';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {useNavigation} from '@react-navigation/native';
import {useEffect, useMemo, useRef} from 'react';
import {applyErrorAnimationTheme} from '../../../../../functions/lottieViewColorTransformer';

export default function ErrorWithPayment({reason}) {
  const {theme, darkModeType} = useGlobalThemeContext();
  const navigate = useNavigation();
  const windowWidth = useWindowDimensions().width;
  const animationRef = useRef(null);

  const errorAnimation = useMemo(() => {
    const confirmTxAnimationDarkMode = require('../../../../../assets/errorTxAnimation.json');

    const defaultTheme = applyErrorAnimationTheme(
      confirmTxAnimationDarkMode,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );

    return defaultTheme;
  }, [theme, darkModeType]);

  useEffect(() => {
    animationRef.current?.play();
  }, []);
  return (
    <GlobalThemeView styles={styles.container} useStandardWidth={true}>
      <LottieView
        ref={animationRef}
        source={errorAnimation}
        loop={false}
        style={{
          width: windowWidth / 1.5,
          height: windowWidth / 1.5,
        }}
      />
      <ThemeText styles={styles.text} content={'Error message'} />
      <ScrollView
        style={{flex: 1, width: '90%', ...CENTER}}
        contentContainerStyle={{alignItems: 'center', paddingVertical: 20}}>
        <ThemeText styles={{textAlign: 'center'}} content={String(reason)} />
      </ScrollView>
      <CustomButton
        buttonStyles={styles.buttonStyle}
        textContent={'Continue'}
        actionFunction={() => {
          navigate.popTo('HomeAdmin', {screen: 'Home'});
        }}
      />
    </GlobalThemeView>
  );
}
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  buttonStyle: {
    marginTop: 'auto',
    width: 'auto',
  },
  text: {
    textAlign: 'center',
    fontSize: SIZES.large,
  },
});
