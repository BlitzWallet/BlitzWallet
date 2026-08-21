import { useEffect, useMemo, useRef } from 'react';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import LottieView from 'lottie-react-native';
import { getErrorTxAnimation } from '../../../../../functions/lottieAnimations';
import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import { WINDOWWIDTH } from '../../../../../constants/theme';
import { CENTER } from '../../../../../constants';

export default function StoreErrorPage({ error }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const animationRef = useRef(null);

  useEffect(() => {
    animationRef.current?.play();
  }, []);

  const errorAnimation = getErrorTxAnimation(theme, darkModeType);

  return (
    <View style={styles.container}>
      <LottieView
        ref={animationRef}
        source={errorAnimation}
        loop={false}
        style={{
          width: 100,
          height: 100,
        }}
      />
      <ThemeText
        styles={{
          maxWidth: 275,
          textAlign: 'center',
          marginBottom: 5,
        }}
        content={error}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    width: WINDOWWIDTH,
    ...CENTER,
    flex: 1,
    alignItems: 'center',
  },
});
