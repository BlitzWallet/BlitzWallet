import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { CENTER, SIZES } from '../../../../constants';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useCallback, useMemo } from 'react';
import { updateConfirmAnimation } from '../../../../functions/lottieViewColorTransformer';
import LottieView from 'lottie-react-native';
import CustomButton from '../../../../functions/CustomElements/button';
import { WINDOWWIDTH } from '../../../../constants/theme';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';

const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

export default function SavingsGoalSuccess(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const amount = Number(props?.route?.params?.amount || 0);
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
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
            content={t('savings.goalSuccess.title', {
              amount: displayCorrectDenomination({
                amount: amount,
                masterInfoObject: {
                  ...masterInfoObject,
                  userBalanceDenomination: 'fiat',
                },
                fiatStats,
                convertAmount: false,
                forceCurrency: 'USD',
              }),
            })}
          />
          <ThemeText
            styles={styles.subtitle}
            content={t('savings.goalSuccess.subtitle')}
          />
        </View>

        <CustomButton
          buttonStyles={styles.button}
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
    marginTop: 30,
    alignItems: 'center',
    gap: 12,
  },
  animation: {
    width: 150,
    height: 150,
  },
  title: {
    fontSize: SIZES.large,
    textAlign: 'center',
    includeFontPadding: false,
  },
  subtitle: {
    opacity: 0.7,
    includeFontPadding: false,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
