import { useGlobalThemeContext } from '../../../../context-store/theme';
import MotionLottie from '../../../functions/CustomElements/MotionLottie';
import { StyleSheet, View } from 'react-native';
import { getConfirmTxAnimation } from '../../../functions/lottieAnimations';
import { ThemeText } from '../../../functions/CustomElements';
import { useTranslation } from 'react-i18next';

export default function ChildQRWaiting() {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();
  const confirmAnimation = getConfirmTxAnimation(theme, darkModeType);

  return (
    <View style={styles.container}>
      <MotionLottie
        source={confirmAnimation}
        renderMode="SOFTWARE"
        loop={false}
        autoPlay={true}
        style={styles.animation}
      />
      <ThemeText
        styles={styles.subtitle}
        content={t('settings.childAccounts.claim.scanWaiting')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  animation: {
    width: 100,
    height: 100,
  },
  subtitle: {
    width: '95%',
    maxWidth: 300,
    textAlign: 'center',
  },
});
