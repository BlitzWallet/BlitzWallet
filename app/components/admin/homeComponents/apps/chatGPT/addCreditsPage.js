import {
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { CENTER, COLORS, SIZES } from '../../../../../constants';
import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import CustomButton from '../../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import { AI_MODEL_COST } from './contants/AIModelCost';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { sparkPaymenWrapper } from '../../../../../functions/spark/payments';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { useWebView } from '../../../../../../context-store/webViewContext';

const CREDITOPTIONS = [
  {
    title: 'apps.chatGPT.addCreditsPage.casualPlanTitle',
    price: 2200,
    numSerches: '40',
    isSelected: false,
  },
  {
    title: 'apps.chatGPT.addCreditsPage.proPlanTitle',
    price: 3300,
    numSerches: '100',
    isSelected: true,
  },
  {
    title: 'apps.chatGPT.addCreditsPage.powerPlanTitle',
    price: 4400,
    numSerches: '150',
    isSelected: false,
  },
];
//price is in sats

export default function AddChatGPTCredits({ confirmationSliderData }) {
  const { sendWebViewRequest } = useWebView();
  const { sparkInformation } = useSparkWallet();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { theme, darkModeType } = useGlobalThemeContext();
  const {
    decodedChatGPT,
    toggleGlobalAppDataInformation,
    globalAppDataInformation,
  } = useGlobalAppData();
  const { textColor, backgroundOffset, backgroundColor } = GetThemeColors();
  const { masterInfoObject } = useGlobalContextProvider();

  const [selectedSubscription, setSelectedSubscription] =
    useState(CREDITOPTIONS);
  const [isPaying, setIsPaying] = useState(false);
  const navigate = useNavigation();
  const { t } = useTranslation();

  useEffect(() => {
    // FUNCTION TO PURCHASE CREDITS
    if (!confirmationSliderData?.purchaseCredits) return;
    navigate.setParams({ purchaseCredits: null });
    payForChatGPTCredits(confirmationSliderData?.invoiceInformation);
  }, [confirmationSliderData?.purchaseCredits]);

  const subscriptionElements = selectedSubscription.map((subscription, id) => {
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedSubscription(prev => {
            return prev.map(item => {
              if (item.title === subscription.title) {
                return { ...item, isSelected: true };
              } else return { ...item, isSelected: false };
            });
          });
        }}
        style={{
          width: '100%',
          marginBottom: id === selectedSubscription.length ? 0 : 20,
        }}
        key={id}
      >
        <View
          style={[
            styles.optionContainer,
            {
              borderColor: textColor,
              backgroundColor: subscription.isSelected
                ? backgroundOffset
                : 'transparent',
            },
          ]}
        >
          <View>
            <ThemeText
              styles={{ fontWeight: 'bold', marginBottom: 10 }}
              content={t(subscription.title)}
            />
            <FormattedSatText
              neverHideBalance={true}
              styles={{ ...styles.infoDescriptions }}
              frontText={t('apps.chatGPT.addCreditsPage.price')}
              balance={subscription.price}
            />
          </View>

          <ThemeText
            styles={{ flexShrink: 1 }}
            CustomNumberOfLines={1}
            content={t('apps.chatGPT.addCreditsPage.estSearches', {
              num: subscription.numSerches,
            })}
          />
        </View>
      </TouchableOpacity>
    );
  });

  const availableModels = AI_MODEL_COST.map(item => {
    return (
      <ThemeText
        key={item.name}
        styles={{ fontSize: SIZES.small, marginVertical: 2.5 }}
        content={item.name}
      />
    );
  });

  if (Platform.OS === 'ios' || Platform.OS === 'macos') {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar label={t('apps.chatGPT.addCreditsPage.title')} />
        <View style={styles.errorContainer}>
          <ThemeText
            styles={styles.errorText}
            content={t('apps.chatGPT.addCreditsPage.notAvailableMessage')}
          />
          <CustomButton
            actionFunction={navigate.goBack}
            textContent={t('settings.posPath.totalTipsScreen.goBack')}
          />
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={t('apps.chatGPT.addCreditsPage.title')} />
      {!isPaying ? (
        <>
          <View style={styles.globalContainer}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 20 }}
            >
              <ThemeText
                styles={{ textAlign: 'center', marginBottom: 20 }}
                content={t('apps.chatGPT.addCreditsPage.description')}
              />
              {subscriptionElements}
              <View style={{ marginTop: 0, alignItems: 'center' }}>
                <ThemeText
                  styles={{ fontWeight: 500, fontSize: SIZES.large }}
                  content={t('apps.chatGPT.addCreditsPage.supportedModels')}
                />
                {availableModels}
              </View>
              <ThemeText
                styles={{
                  textAlign: 'center',
                  color:
                    theme && darkModeType
                      ? COLORS.darkModeText
                      : COLORS.primary,
                  fontSize: SIZES.small,
                  marginTop: 10,
                }}
                content={t('apps.chatGPT.addCreditsPage.feeInfo')}
              />
            </ScrollView>
          </View>

          <CustomButton
            buttonStyles={{
              width: 'auto',
              ...CENTER,
            }}
            actionFunction={() => {
              const [selectedPlan] = selectedSubscription.filter(
                subscription => subscription.isSelected,
              );
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'chatGPT',
                price: selectedPlan.price,
                plan: selectedPlan.title,
                sliderHight: 0.5,
              });
            }}
            textContent={t('constants.pay')}
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
      const selectedPlan = selectedSubscription.filter(
        subscription => subscription.isSelected,
      )[0];
      let invoice = '';
      let fee;
      let creditPrice;
      creditPrice = selectedPlan.price;
      creditPrice += 150; //blitz flat fee
      creditPrice += Math.ceil(creditPrice * 0.005);

      invoice = invoiceInformation.invoice;

      creditPrice = selectedPlan.price;

      fee = invoiceInformation.fee + invoiceInformation.supportFee;

      if (sparkInformation.balance < creditPrice + fee)
        throw new Error('Insufficent balance');

      const paymentResponse = await sparkPaymenWrapper({
        getFee: false,
        address: invoice,
        paymentType: 'lightning',
        amountSats: creditPrice,
        fee: fee,
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
            credits: decodedChatGPT.credits + selectedPlan.price,
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

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    width: '95%',
    textAlign: 'center',
    marginBottom: 20,
  },

  optionContainer: {
    width: '100%',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
  },
});
