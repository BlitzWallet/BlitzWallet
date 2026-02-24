import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useCallback, useMemo } from 'react';
import { updateConfirmAnimation } from '../../../../functions/lottieViewColorTransformer';
import LottieView from 'lottie-react-native';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import CustomButton from '../../../../functions/CustomElements/button';
import { WINDOWWIDTH } from '../../../../constants/theme';

const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

export default function SavingsGoalRemovedSuccess() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();

  const handleGoHome = useCallback(() => {
    navigate.popTo('SavingsHome');
    return true;
  }, []);

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  useHandleBackPressNew(handleGoHome);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar customBackFunction={handleGoHome} />
      <View style={styles.container}>
        <View style={styles.content}>
          <LottieView
            source={confirmAnimation}
            loop={false}
            autoPlay={true}
            style={styles.animation}
          />
          <ThemeText
            styles={styles.title}
            content={t('savings.goalRemovedSuccess.title')}
          />
        </View>

        <CustomButton
          actionFunction={handleGoHome}
          textContent={t('constants.done')}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: WINDOWWIDTH,
    justifyContent: 'space-between',
    ...CENTER,
  },
  content: {
    marginTop: 60,
    alignItems: 'center',
    gap: 12,
  },
  animation: {
    width: 150,
    height: 150,
  },
  title: {
    fontSize: SIZES.large,
    includeFontPadding: false,
    textAlign: 'center',
  },
  button: {
    borderRadius: 22,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  buttonText: {
    color: COLORS.white,
    includeFontPadding: false,
  },
});
