import { ScrollView, StyleSheet, View } from 'react-native';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
} from '../../../../../constants';
import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import CustomButton from '../../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { sparkPaymenWrapper } from '../../../../../functions/spark/payments';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import { useWebView } from '../../../../../../context-store/webViewContext';
import { Check } from 'lucide-react-native';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import QuestionDiscoveryGrid from './questionDiscoveryGrid';

const FEATURES = [
  'apps.chatGPT.addCreditsPage.feature1',
  'apps.chatGPT.addCreditsPage.feature2',
  'apps.chatGPT.addCreditsPage.feature3',
  'apps.chatGPT.addCreditsPage.feature4',
  'apps.chatGPT.addCreditsPage.feature5',
];

export default function AddChatGPTCredits({ confirmationSliderData }) {
  const { sendWebViewRequest } = useWebView();
  const { sparkInformation } = useSparkWallet();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const {
    decodedChatGPT,
    toggleGlobalAppDataInformation,
    globalAppDataInformation,
  } = useGlobalAppData();
  const { textColor, backgroundColor, backgroundOffset } = GetThemeColors();
  const { masterInfoObject } = useGlobalContextProvider();
  const [isPaying, setIsPaying] = useState(false);

  const navigate = useNavigation();
  const { t } = useTranslation();

  useEffect(() => {
    // FUNCTION TO PURCHASE CREDITS
    if (!confirmationSliderData?.purchaseCredits) return;
    navigate.setParams({ purchaseCredits: null });
    payForChatGPTCredits(confirmationSliderData?.invoiceInformation);
  }, [confirmationSliderData?.purchaseCredits]);

  const featureElements = FEATURES.map((key, index) => (
    <View key={index} style={styles.featureRow}>
      <View style={[styles.checkCircle, { backgroundColor: textColor }]}>
        <Check size={14} color={backgroundColor} strokeWidth={3} />
      </View>
      <ThemeText styles={styles.featureText} content={t(key)} />
    </View>
  ));

  return (
    <GlobalThemeView useStandardWidth={true}>
      {!isPaying ? (
        <>
          <CustomSettingsTopBar />
          <View style={styles.globalContainer}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <ThemeText
                styles={styles.unlockTitle}
                content={t('apps.chatGPT.addCreditsPage.unlockTitle')}
              />

              <View style={styles.featuresContainer}>{featureElements}</View>
              <QuestionDiscoveryGrid />
            </ScrollView>
          </View>

          <CustomButton
            buttonStyles={{
              width: INSET_WINDOW_WIDTH,
              marginTop: CONTENT_KEYBOARD_OFFSET,
              ...CENTER,
            }}
            actionFunction={() => {
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'chatGPT',
                sliderHight: 0.5,
              });
            }}
            textContent={t('constants.continue')}
          />
        </>
      ) : (
        <FullLoadingScreen
          text={`${t('constants.processing')}...`}
          textStyles={{
            fontSize: SIZES.large,
            textAlign: 'center',
          }}
        />
      )}
    </GlobalThemeView>
  );

  async function payForChatGPTCredits(invoiceInformation) {
    try {
      setIsPaying(true);
      const creditAmount = invoiceInformation?.creditPrice;
      if (!creditAmount || creditAmount < 2000)
        throw new Error('Invalid credit amount');
      const fee = invoiceInformation.fee + invoiceInformation.supportFee;
      if (sparkInformation.balance < creditAmount + fee)
        throw new Error('Insufficient balance');
      const paymentResponse = await sparkPaymenWrapper({
        getFee: false,
        address: invoiceInformation.invoice,
        paymentType: 'lightning',
        amountSats: creditAmount,
        fee,
        memo: t('apps.chatGPT.addCreditsPage.paymentMemo'),
        masterInfoObject,
        sparkInformation,
        userBalance: sparkInformation.balance,
        mnemonic: currentWalletMnemoinc,
        sendWebViewRequest,
      });
      if (!paymentResponse.didWork) throw new Error(paymentResponse.error);
      toggleGlobalAppDataInformation(
        {
          chatGPT: {
            conversation: globalAppDataInformation.chatGPT.conversation || [],
            credits:
              decodedChatGPT.credits +
              (invoiceInformation.selectedAmountSats || 0),
          },
        },
        true,
      );
    } catch (err) {
      console.log(err);
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.paymentError'),
      });
    } finally {
      setIsPaying(false);
    }
  }
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scrollContent: {
    paddingVertical: 10,
  },

  unlockTitle: {
    fontSize: SIZES.xxLarge,
    fontWeight: 'bold',
    marginBottom: 24,
    marginTop: 8,
  },

  featuresContainer: {
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  featureText: {
    fontSize: SIZES.medium,
    flexShrink: 1,
    includeFontPadding: false,
  },
});
