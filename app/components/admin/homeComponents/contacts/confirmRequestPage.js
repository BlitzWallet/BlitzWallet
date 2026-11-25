import MotionLottie from '../../../../functions/CustomElements/MotionLottie';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import {
  useGlobalThemeContext,
  useTheme,
} from '../../../../../context-store/theme';
import { getConfirmTxAnimation } from '../../../../functions/lottieAnimations';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import CustomButton from '../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  AMOUNT_HERO_SIZE,
  CENTER,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import {
  RecipientAvatar,
  resolveRecipientDisplay,
} from '../sendBitcoin/components/recipientCard';

export default function ConfirmPaymentRequset(props) {
  const navigate = useNavigation();
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const { theme, darkModeType } = useGlobalThemeContext();
  const confirmAnimation = getConfirmTxAnimation(theme, darkModeType);
  const {
    amount,
    fiatStats,
    masterInfoObject,
    forceCurrency,
    selectedContact,
  } = props?.route?.params;

  const recipientResolved = resolveRecipientDisplay({
    lnurlAddress: '',
    contactInfo: selectedContact,
    brantaName: '',
    brantaLogo: '',
    transaction: '',
    stablecoinInfo: '',
  });

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <View style={styles.content}>
          <MotionLottie
            autoPlay={true}
            source={confirmAnimation}
            renderMode="SOFTWARE"
            loop={false}
            style={styles.lottie}
          />

          <AmountHero
            amount={amount}
            convertAmount={false}
            fiatStats={fiatStats}
            forceCurrency={forceCurrency}
            masterInfoObject={masterInfoObject}
            amountSize={AMOUNT_HERO_SIZE.primary}
          />

          <ThemeText
            content={t('screens.inAccount.confirmTxPage.confirmMessage_sent')}
            styles={[styles.status, { color: tokens.muted }]}
          />

          <View
            style={[styles.recipientCard, { backgroundColor: tokens.surface }]}
          >
            <RecipientAvatar
              resolved={recipientResolved}
              size={30}
              backgroundColor={tokens.disc}
            />
            <ThemeText
              styles={styles.recipientName}
              CustomNumberOfLines={1}
              content={recipientResolved.displayName}
            />
          </View>
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
  lottie: { width: 125, height: 125 },
  status: {
    fontFamily: FONT.Title_Regular,
    fontSize: 16,
    lineHeight: 24,
    includeFontPadding: false,
    maxWidth: 300,
    textAlign: 'center',
    marginTop: 8,
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: '100%',
    minHeight: 54,
    marginTop: 40,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 20,
    borderRadius: 999,
    columnGap: 10,
  },
  recipientName: {
    flexShrink: 1,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
    fontSize: 15,
  },
});
