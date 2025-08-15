import {useEffect, useState} from 'react';
import {StyleSheet, View, ScrollView} from 'react-native';
import {CENTER, SIZES} from '../../../../constants';
import {ThemeText} from '../../../../functions/CustomElements';
import {useNavigation} from '@react-navigation/native';
import {getInfo} from '@breeztech/react-native-breez-sdk-liquid';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import CustomButton from '../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {useAppStatus} from '../../../../../context-store/appStatus';
import {useGlobalContacts} from '../../../../../context-store/globalContacts';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import liquidToSparkSwap from '../../../../functions/spark/liquidToSparkSwap';
import {useTranslation} from 'react-i18next';

export default function ViewAllLiquidSwaps(props) {
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const [isLoading, setIsLoading] = useState(false);
  const {globalContactsInformation} = useGlobalContacts();
  const {masterInfoObject} = useGlobalContextProvider();
  const {fiatStats} = useNodeContext();
  const [liquidInfoResponse, setLiquidInfoResponse] = useState({});

  const liquidBalance =
    liquidInfoResponse?.walletInfo?.balanceSat !== undefined
      ? liquidInfoResponse?.walletInfo?.balanceSat -
        (liquidInfoResponse?.walletInfo?.pendingSendSat || 0)
      : null;

  const navigate = useNavigation();
  const {t} = useTranslation();

  const retriveLiquidBalance = async isRescan => {
    try {
      setIsLoading(true);
      const infoResponse = await getInfo();

      setLiquidInfoResponse(infoResponse);
      if (isRescan) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('settings.viewAllLiquidSwaps.rescanComplete'),
        });
      }
    } catch (err) {
      console.log(err);
      navigate.navigate('ErrorScreen', {errorMessage: err.message});
    } finally {
      setIsLoading(false);
    }
  };

  const swapLiquidToLightning = async () => {
    try {
      if (liquidBalance > minMaxLiquidSwapAmounts.min) {
        setIsLoading(true);

        const paymentResponse = await liquidToSparkSwap(
          globalContactsInformation.myProfile.uniqueName,
        );

        if (!paymentResponse.didWork) throw new Error(t(paymentResponse.error));

        navigate.navigate('ErrorScreen', {
          errorMessage: t('settings.viewAllLiquidSwaps.swapStartedMessage'),
        });
        retriveLiquidBalance(false);
      } else
        throw new Error(
          t('settings.viewAllLiquidSwaps.balanceError', {
            balance: displayCorrectDenomination({
              amount: liquidBalance,
              masterInfoObject,
              fiatStats,
            }),
            swapAmount: displayCorrectDenomination({
              amount: minMaxLiquidSwapAmounts.min,
              masterInfoObject,
              fiatStats,
            }),
          }),
        );
    } catch (err) {
      console.log(err);
      navigate.navigate('ErrorScreen', {errorMessage: err.message});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    retriveLiquidBalance(false);
  }, []);

  return (
    <View style={styles.globalContainer}>
      {liquidBalance === null ? (
        <FullLoadingScreen
          text={t('settings.viewAllLiquidSwaps.loadingMessage')}
        />
      ) : liquidBalance <= 0 ? (
        <>
          <ThemeText
            styles={styles.balanceText}
            content={t('settings.viewAllLiquidSwaps.breakdownHead')}
          />
          <ThemeText
            styles={styles.balanceText}
            content={t('settings.viewAllLiquidSwaps.incoming', {
              amount: displayCorrectDenomination({
                amount: liquidInfoResponse?.walletInfo?.pendingReceiveSat || 0,
                masterInfoObject,
                fiatStats,
              }),
            })}
          />
          <ThemeText
            styles={styles.balanceText}
            content={t('settings.viewAllLiquidSwaps.outgoing', {
              amount: displayCorrectDenomination({
                amount: liquidInfoResponse?.walletInfo?.pendingSendSat || 0,
                masterInfoObject,
                fiatStats,
              }),
            })}
          />
          <ThemeText
            styles={{...styles.balanceText, marginBottom: 30}}
            content={t('settings.viewAllLiquidSwaps.balance', {
              amount: displayCorrectDenomination({
                amount: liquidInfoResponse?.walletInfo?.balanceSat || 0,
                masterInfoObject,
                fiatStats,
              }),
            })}
          />
          <CustomButton
            actionFunction={() => retriveLiquidBalance(true)}
            textContent={t('settings.viewAllLiquidSwaps.rescan')}
            useLoading={isLoading}
          />
        </>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <ThemeText
            styles={styles.amountText}
            content={t('settings.viewAllLiquidSwaps.totalBalance')}
          />
          <FormattedSatText styles={styles.valueText} balance={liquidBalance} />

          <View
            style={{
              marginTop: 40,
              width: INSET_WINDOW_WIDTH,
              ...CENTER,
            }}>
            <ThemeText
              styles={{textAlign: 'center'}}
              content={t('settings.viewAllLiquidSwaps.swapMessage')}
            />
            <CustomButton
              buttonStyles={{marginTop: 40, ...CENTER}}
              actionFunction={swapLiquidToLightning}
              textContent={t('settings.viewAllLiquidSwaps.swap')}
              useLoading={isLoading}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountText: {
    textTransform: 'uppercase',
    marginBottom: 0,
    textAlign: 'center',
    marginTop: 20,
  },
  valueText: {
    fontSize: SIZES.xxLarge,
    includeFontPadding: false,
  },

  balanceText: {
    width: '95%',
    maxWidth: 250,
    textAlign: 'center',
    marginBottom: 10,
  },

  swapContainer: {
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },

  buttonContainer: {
    paddingVertical: 8,
    paddingHorizontal: 17,
    borderRadius: 9,
  },
});
