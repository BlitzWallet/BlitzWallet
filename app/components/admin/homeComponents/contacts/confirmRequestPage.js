import MotionLottie from '../../../../functions/CustomElements/MotionLottie';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { getConfirmTxAnimation } from '../../../../functions/lottieAnimations';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import CustomButton from '../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  AMOUNT_HERO_SIZE,
  CENTER,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import { useNavigation } from '@react-navigation/native';

export default function ConfirmPaymentRequset(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { theme, darkModeType } = useGlobalThemeContext();
  const confirmAnimation = getConfirmTxAnimation(theme, darkModeType);
  const { amount, fiatStats, masterInfoObject, forceCurrency, name } =
    props?.route?.params;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <View style={styles.content}>
          <MotionLottie
            autoPlay={true}
            source={confirmAnimation}
            renderMode="SOFTWARE"
            loop={false}
            style={{
              width: 130,
              height: 130,
            }}
          />
          <ThemeText
            content={t('contacts.confirmRequestPage.requestSent')}
            variant={'hint'}
            styles={{ marginBottom: -2 }}
          />
          <AmountHero
            amount={amount}
            convertAmount={false}
            fiatStats={fiatStats}
            forceCurrency={forceCurrency}
            masterInfoObject={masterInfoObject}
            amountSize={AMOUNT_HERO_SIZE.secondary}
          />
          <ThemeText
            styles={{ marginTop: 8 }}
            content={t('contacts.confirmRequestPage.toName', { name })}
          />
        </View>
        <CustomButton
          actionFunction={navigate.goBack}
          textContent={t('constants.done')}
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
