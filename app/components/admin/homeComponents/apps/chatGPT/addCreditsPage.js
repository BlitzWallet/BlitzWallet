import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {
  CENTER,
  COLORS,
  ICONS,
  // LIQUID_DEFAULT_FEE,
  SIZES,
} from '../../../../../constants';
import {useEffect, useState} from 'react';
import {useNavigation} from '@react-navigation/native';

import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import CustomButton from '../../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
// import {
//   LIGHTNINGAMOUNTBUFFER,
//   LIQUIDAMOUTBUFFER,
//   SATSPERBITCOIN,
// } from '../../../../../constants/math';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import {AI_MODEL_COST} from './contants/AIModelCost';
import {getLNAddressForLiquidPayment} from '../../sendBitcoin/functions/payments';
// import {breezPaymentWrapper} from '../../../../../functions/SDK';
// import {breezLiquidPaymentWrapper} from '../../../../../functions/breezLiquid';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
// import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
// import {getStoredProofs} from '../../../../../functions/eCash/db';
// import {sumProofsValue} from '../../../../../functions/eCash/proofs';
// import {
//   getMeltQuote,
//   payLnInvoiceFromEcash,
// } from '../../../../../functions/eCash/wallet';
// import breezLNAddressPaymentWrapperV2 from '../../../../../functions/SDK/lightningAddressPaymentWrapperV2';
// import formatBip21LiquidAddress from '../../../../../functions/liquidWallet/formatBip21liquidAddress';
import {parse} from '@breeztech/react-native-breez-sdk-liquid';
import {useSparkWallet} from '../../../../../../context-store/sparkContext';
import {sparkPaymenWrapper} from '../../../../../functions/spark/payments';

const CREDITOPTIONS = [
  {
    title: 'Casual Plan',
    price: 2200,
    numSerches: '40',
    isSelected: false,
  },
  {
    title: 'Pro Plan',
    price: 3300,
    numSerches: '100',
    isSelected: true,
  },
  {
    title: 'Power Plan',
    price: 4400,
    numSerches: '150',
    isSelected: false,
  },
];
//price is in sats

export default function AddChatGPTCredits({confirmationSliderData}) {
  const {sparkInformation} = useSparkWallet();
  // const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {
    decodedChatGPT,
    toggleGlobalAppDataInformation,
    globalAppDataInformation,
  } = useGlobalAppData();
  const {textColor, backgroundOffset, backgroundColor} = GetThemeColors();
  const {masterInfoObject} = useGlobalContextProvider();

  const [selectedSubscription, setSelectedSubscription] =
    useState(CREDITOPTIONS);
  const [isPaying, setIsPaying] = useState(false);
  const navigate = useNavigation();

  useEffect(() => {
    // FUNCTION TO PURCHASE CREDITS
    if (!confirmationSliderData?.purchaseCredits) return;
    navigate.setParams({purchaseCredits: null});
    payForChatGPTCredits(confirmationSliderData?.invoiceInformation);
  }, [confirmationSliderData?.purchaseCredits]);

  const subscriptionElements = selectedSubscription.map((subscription, id) => {
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedSubscription(prev => {
            return prev.map(item => {
              if (item.title === subscription.title) {
                return {...item, isSelected: true};
              } else return {...item, isSelected: false};
            });
          });
        }}
        style={{
          width: '100%',
          marginBottom: id === selectedSubscription.length ? 0 : 20,
        }}
        key={id}>
        <View
          style={[
            styles.optionContainer,
            {
              borderColor: textColor,
              backgroundColor: subscription.isSelected
                ? backgroundOffset
                : 'transparent',
            },
          ]}>
          <View>
            <ThemeText
              styles={{fontWeight: 'bold', marginBottom: 10}}
              content={subscription.title}
            />
            <FormattedSatText
              neverHideBalance={true}
              styles={{...styles.infoDescriptions}}
              frontText={'Price: '}
              balance={subscription.price}
            />
          </View>

          <ThemeText content={` Est. searches: ${subscription.numSerches}`} />
        </View>
      </TouchableOpacity>
    );
  });

  const availableModels = AI_MODEL_COST.map(item => {
    return (
      <ThemeText
        key={item.name}
        styles={{fontSize: SIZES.small, marginVertical: 2.5}}
        content={item.name}
      />
    );
  });
  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={{position: 'absolute'}}
          onPress={() => {
            navigate.goBack();
          }}>
          <ThemeImage
            lightsOutIcon={ICONS.arrow_small_left_white}
            lightModeIcon={ICONS.smallArrowLeft}
            darkModeIcon={ICONS.smallArrowLeft}
          />
        </TouchableOpacity>
        <ThemeText
          styles={{
            fontSize: SIZES.large,
            marginRight: 'auto',
            marginLeft: 'auto',
          }}
          content={'Add Credits'}
        />
      </View>
      {!isPaying ? (
        <>
          <View style={styles.globalContainer}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{paddingVertical: 20}}>
              <ThemeText
                styles={{textAlign: 'center', marginBottom: 20}}
                content={
                  'In order to use the latest generative AI models, you must buy credits. Choose an option below to begin.'
                }
              />
              {subscriptionElements}
              <View style={{marginTop: 0, alignItems: 'center'}}>
                <ThemeText
                  styles={{fontWeight: 500, fontSize: SIZES.large}}
                  content={'Supported Models'}
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
                content="Depending on the length of your question and response, the number of searches you get might be different. Blitz adds a 150 sat fee + 0.5% of purchase price onto all purchases."
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
            textContent={'Pay'}
          />
        </>
      ) : (
        <FullLoadingScreen
          text={'Processing...'}
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
      let invoice = '';
      let fee;
      let creditPrice;
      let selectedPlan;

      if (invoiceInformation.invoice) {
        invoice = invoiceInformation.invoice;
      } else {
        selectedPlan = selectedSubscription.filter(
          subscription => subscription.isSelected,
        )[0];
        creditPrice = selectedPlan.price;
        creditPrice += 150; //blitz flat fee
        creditPrice += Math.ceil(creditPrice * 0.005);

        // const lightningFee = creditPrice * 0.005 + 4;
        const lnPayoutLNURL = process.env.GPT_PAYOUT_LNURL;
        const input = await parse(lnPayoutLNURL);
        const lnInvoice = await getLNAddressForLiquidPayment(
          input,
          creditPrice,
          'Store - chatGPT',
        );
        invoice = lnInvoice;
      }

      if (invoiceInformation.fee && invoiceInformation.supportFee) {
        fee = invoiceInformation.fee + invoiceInformation.supportFee;
      } else {
        const feeResponse = await sparkPaymenWrapper({
          getFee: true,
          address: invoice,
          paymentType: 'lightning',
          amountSats: creditPrice,
          masterInfoObject,
          sparkInformation,
          userBalance: sparkInformation.balance,
        });

        if (!feeResponse.didWork) throw new Error(feeResponse.error);

        fee = feeResponse.fee + feeResponse.supportFee;
      }

      if (sparkInformation.balance < fee)
        throw new Error('Insufficent balance');

      const paymentResponse = await sparkPaymenWrapper({
        getFee: false,
        address: invoice,
        paymentType: 'lightning',
        amountSats: creditPrice,
        fee: fee,
        memo: 'Store - chatGPT',
        masterInfoObject,
        sparkInformation,
        userBalance: sparkInformation.balance,
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

      // if (masterInfoObject.enabledEcash) {
      //   try {
      //     const input = await parse(lnPayoutLNURL);

      //     const lnInvoice = await getLNAddressForLiquidPayment(
      //       input,
      //       creditPrice,
      //       'Store - chatGPT',
      //     );
      //     if (!lnInvoice) throw new Error('Not able to parse ln invoice');
      //     const storedProofs = await getStoredProofs();
      //     const balance = sumProofsValue(storedProofs);
      //     if (balance > creditPrice + lightningFee) {
      //       const meltQuote = await getMeltQuote(lnInvoice);
      //       if (!meltQuote.quote)
      //         throw new Error(
      //           meltQuote.reason || 'Not able to generate ecash quote',
      //         );
      //       const didPay = await payLnInvoiceFromEcash({
      //         quote: meltQuote.quote,
      //         invoice: lnInvoice,
      //         proofsToUse: meltQuote.proofsToUse,
      //         description: 'Store - chatGPT',
      //       });
      //       if (!didPay.didWork) throw new Error(didPay.message);
      //       toggleGlobalAppDataInformation(
      //         {
      //           chatGPT: {
      //             conversation:
      //               globalAppDataInformation.chatGPT.conversation || [],
      //             credits: decodedChatGPT.credits + selectedPlan.price,
      //           },
      //         },
      //         true,
      //       );
      //       setIsPaying(false);
      //       return;
      //     }
      //   } catch (err) {
      //     console.warn('eCash payment failed:', err.message);
      //   }
      // }

      // if (
      //   liquidNodeInformation.userBalance -
      //     LIQUIDAMOUTBUFFER -
      //     LIQUID_DEFAULT_FEE >
      //   creditPrice
      // ) {
      //   const liquidBip21 = formatBip21LiquidAddress({
      //     address: process.env.BLITZ_LIQUID_ADDRESS,
      //     amount: creditPrice,
      //     message: 'Store - chatGPT',
      //   });

      //   const response = await breezLiquidPaymentWrapper({
      //     paymentType: 'liquid',
      //     invoice: liquidBip21,
      //   });

      //   if (!response.didWork) {
      //     navigate.navigate('ErrorScreen', {
      //       errorMessage: 'Error completing payment',
      //     });
      //     setIsPaying(false);
      //     return;
      //   }
      //   await toggleGlobalAppDataInformation(
      //     {
      //       chatGPT: {
      //         conversation: globalAppDataInformation.chatGPT.conversation || [],
      //         credits: decodedChatGPT.credits + selectedPlan.price,
      //       },
      //     },
      //     true,
      //   );
      //   setIsPaying(false);
      //   return;
      // }

      // if (
      //   nodeInformation.userBalance - LIGHTNINGAMOUNTBUFFER - lightningFee >
      //   creditPrice
      // ) {
      //   const input = await parse(lnPayoutLNURL);

      //   const paymentResponse = await breezLNAddressPaymentWrapperV2({
      //     sendingAmountSat: creditPrice,
      //     paymentInfo: input,
      //     paymentDescription: 'Store - chatGPT',
      //   });
      //   if (!paymentResponse.didWork) {
      //     navigate.navigate('ErrorScreen', {
      //       errorMessage: 'Error completing payment',
      //     });
      //     setIsPaying(false);
      //     return;
      //   }
      //   await toggleGlobalAppDataInformation(
      //     {
      //       chatGPT: {
      //         conversation: globalAppDataInformation.chatGPT.conversation || [],
      //         credits: decodedChatGPT.credits + selectedPlan.price,
      //       },
      //     },
      //     true,
      //   );
      //   setIsPaying(false);
      // } else {
      //   navigate.navigate('ErrorScreen', {errorMessage: 'Not enough funds.'});
      //   setIsPaying(false);
      // }
    } catch (err) {
      console.log(err);
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Error processing payment. Try again.',
      });
    } finally {
      setIsPaying(false);
    }
  }
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
  },

  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
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
