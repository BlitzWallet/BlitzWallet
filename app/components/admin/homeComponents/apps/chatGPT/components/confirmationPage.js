import {StyleSheet, useWindowDimensions, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {ThemeText} from '../../../../../../functions/CustomElements';
import {SIZES} from '../../../../../../constants';
import FormattedSatText from '../../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../../hooks/themeColors';
import SwipeButtonNew from '../../../../../../functions/CustomElements/sliderButton';
import {useCallback, useEffect, useState} from 'react';
import FullLoadingScreen from '../../../../../../functions/CustomElements/loadingScreen';
import {getLNAddressForLiquidPayment} from '../../../sendBitcoin/functions/payments';
import {sparkPaymenWrapper} from '../../../../../../functions/spark/payments';
import {parse} from '@breeztech/react-native-breez-sdk-liquid';
import {useGlobalContextProvider} from '../../../../../../../context-store/context';
import {useSparkWallet} from '../../../../../../../context-store/sparkContext';
import StoreErrorPage from '../../components/errorScreen';
import {useActiveCustodyAccount} from '../../../../../../../context-store/activeAccount';
import {useTranslation} from 'react-i18next';

export default function ConfirmChatGPTPage(props) {
  const navigate = useNavigation();
  const {currentWalletMnemoinc} = useActiveCustodyAccount();
  const {masterInfoObject} = useGlobalContextProvider();
  const {sparkInformation} = useSparkWallet();
  const theme = props?.theme;
  const darkModeType = props?.darkModeType;
  const {textColor, backgroundOffset, backgroundColor} = GetThemeColors();
  const [error, setError] = useState('');
  const {t} = useTranslation();

  const [invoiceInformation, setInvoiceInformation] = useState(null);

  useEffect(() => {
    async function geneateInvoiceAndFee() {
      try {
        let creditPrice = props.price;
        creditPrice += 150; //blitz flat fee
        creditPrice += Math.ceil(creditPrice * 0.005);
        const lnPayoutLNURL = process.env.GPT_PAYOUT_LNURL;
        let input;
        try {
          input = await parse(lnPayoutLNURL);
        } catch (err) {
          setError(t('errormessages.invoiceRetrivalError'));
          return;
        }
        const lnInvoice = await getLNAddressForLiquidPayment(
          input,
          creditPrice,
          'Store - chatGPT',
        );
        const fee = await sparkPaymenWrapper({
          getFee: true,
          address: lnInvoice,
          paymentType: 'lightning',
          amountSats: creditPrice,
          masterInfoObject,
          sparkInformation,
          userBalance: sparkInformation.balance,
          mnemonic: currentWalletMnemoinc,
        });
        if (!fee.didWork) throw new Error(fee.error);
        if (sparkInformation.balance < fee.supportFee + fee.fee) {
          throw new Error(
            t('errormessages.insufficientBalanceError', {
              planType: t(props.plan),
            }),
          );
        }
        setInvoiceInformation({
          fee: fee.fee,
          supportFee: fee.supportFee,
          invoice: lnInvoice,
        });
      } catch (err) {
        console.log('Error generating invoice and fee for chatGPT:', err);
        setError(err.message);
        return;
      }
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        geneateInvoiceAndFee();
      });
    });
  }, []);

  const onSwipeSuccess = useCallback(() => {
    navigate.popTo('AppStorePageIndex', {
      page: 'ai',
      purchaseCredits: true,
      invoiceInformation,
    });
  }, [invoiceInformation]);

  if (error) {
    return <StoreErrorPage error={error} />;
  }

  return (
    <View style={styles.container}>
      {!invoiceInformation ? (
        <FullLoadingScreen />
      ) : (
        <>
          <ThemeText
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
              marginBottom: 5,
            }}
            content={t('apps.chatGPT.confirmationPage.title')}
          />

          <ThemeText
            styles={{fontSize: SIZES.large, marginTop: 10}}
            content={t('apps.chatGPT.confirmationPage.plan', {
              planType: t(props.plan),
            })}
          />
          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{marginTop: 'auto'}}
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
            }}
            frontText={t('apps.chatGPT.confirmationPage.price')}
            balance={props.price}
          />
          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{marginTop: 10, marginBottom: 'auto'}}
            styles={{
              textAlign: 'center',
            }}
            frontText={t('apps.chatGPT.confirmationPage.fee')}
            balance={invoiceInformation.fee + invoiceInformation.supportFee}
          />
          <SwipeButtonNew
            onSwipeSuccess={onSwipeSuccess}
            width={0.95}
            containerStyles={{marginBottom: 20}}
            thumbIconStyles={{
              backgroundColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
              borderColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
            }}
            railStyles={{
              backgroundColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
              borderColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, alignItems: 'center'},
});
