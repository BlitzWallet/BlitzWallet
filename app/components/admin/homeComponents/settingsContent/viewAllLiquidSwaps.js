import {useEffect, useState} from 'react';
import {StyleSheet, View, TouchableOpacity, ScrollView} from 'react-native';
import {CENTER, COLORS, SIZES} from '../../../../constants';
import {ThemeText} from '../../../../functions/CustomElements';
import {useNavigation} from '@react-navigation/native';
import {
  getInfo,
  // listRefundables,
  // parse,
  // rescanOnchainSwaps,
} from '@breeztech/react-native-breez-sdk-liquid';
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

export default function ViewAllLiquidSwaps(props) {
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  // const [liquidBalance, setLiquidBalance] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const {globalContactsInformation} = useGlobalContacts();
  const {masterInfoObject} = useGlobalContextProvider();
  const {fiatStats} = useNodeContext();
  const [liquidInfoResponse, setLiquidInfoResponse] = useState({});

  const liquidBalance =
    liquidInfoResponse?.walletInfo?.balanceSat !== undefined
      ? liquidInfoResponse?.walletInfo?.balanceSat
      : null;
  // const [liquidSwaps, setLiquidSwaps] = useState(null);
  // [
  //   {
  //     amountSat: 50000,
  //     swapAddress:
  //       'bc1p8k4v4xuz55dv49svzjg43qjxq2whur7ync9tm0xgl5t4wjl9ca9snxgmlt',
  //     timestamp: 1714764847,
  //   },
  // ]

  const navigate = useNavigation();

  const retriveLiquidBalance = async isRescan => {
    try {
      setIsLoading(true);
      const infoResponse = await getInfo();
      console.log(infoResponse);

      setLiquidInfoResponse(infoResponse);
      if (isRescan) {
        navigate.navigate('ErrorScreen', {errorMessage: 'Rescan complete'});
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

        if (!paymentResponse.didWork) throw new Error(paymentResponse.error);

        navigate.navigate('ErrorScreen', {
          errorMessage:
            'The swap has started. It may take 10–20 seconds for the payment to show up.',
        });
        retriveLiquidBalance(false);
      } else
        throw new Error(
          `Current liquid balance is ${displayCorrectDenomination({
            amount: liquidBalance,
            masterInfoObject,
            fiatStats,
          })} but the minimum swap amount is ${displayCorrectDenomination({
            amount: minMaxLiquidSwapAmounts.min,
            masterInfoObject,
            fiatStats,
          })}`,
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

  // const transectionElements =
  //   liquidSwaps &&
  //   liquidSwaps.map((tx, id) => {
  //     return (
  //       <View
  //         style={[
  //           styles.swapContainer,
  //           {
  //             marginVertical: 10,
  //           },
  //         ]}
  //         key={id}>
  //         <View style={{flex: 1, marginRight: 50}}>
  //           <ThemeText
  //             styles={{marginBottom: 5}}
  //             CustomNumberOfLines={1}
  //             content={tx?.swapAddress}
  //           />
  //           <ThemeText
  //             CustomNumberOfLines={1}
  //             content={new Date(tx?.timestamp * 1000).toLocaleDateString()}
  //           />
  //         </View>

  //         <TouchableOpacity
  //           style={[
  //             styles.buttonContainer,
  //             {
  //               backgroundColor: props.theme
  //                 ? COLORS.darkModeText
  //                 : COLORS.lightModeText,
  //             },
  //           ]}
  //           onPress={() => {
  //             navigate.navigate('RefundLiquidSwapPopup', {
  //               swapAddress: tx?.swapAddress,
  //             });
  //           }}>
  //           <ThemeText reversed={true} content={'Refund'} />
  //         </TouchableOpacity>
  //       </View>
  //     );
  //   });

  return (
    <View style={styles.globalContainer}>
      {liquidBalance === null ? (
        <FullLoadingScreen text={'Getting failed liquid swaps'} />
      ) : liquidBalance === 0 ? (
        <>
          <ThemeText
            styles={styles.noTxText}
            content={`You have ${displayCorrectDenomination({
              amount: liquidInfoResponse?.walletInfo?.balanceSat || 0,
              masterInfoObject,
              fiatStats,
            })} confirmed and ${displayCorrectDenomination({
              amount: liquidInfoResponse?.walletInfo?.pendingReceiveSat || 0,
              masterInfoObject,
              fiatStats,
            })} pending.`}
          />
          <CustomButton
            actionFunction={() => retriveLiquidBalance(true)}
            textContent={'Rescan'}
            useLoading={isLoading}
          />
        </>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <ThemeText styles={styles.amountText} content={'Total Balance'} />
          <FormattedSatText styles={styles.valueText} balance={liquidBalance} />

          <View
            style={{
              marginTop: 40,
              width: INSET_WINDOW_WIDTH,
              ...CENTER,
            }}>
            <ThemeText
              styles={{textAlign: 'center'}}
              content={`Blitz Wallet will try to swap your Liquid funds into Spark when you first load the app or when you receive Liquid payments.\n\nHowever, in some cases a swap might be missed. To move these funds into Spark manually, just click the Swap button below.`}
            />
            <CustomButton
              buttonStyles={{marginTop: 40, ...CENTER}}
              actionFunction={swapLiquidToLightning}
              textContent={'Swap'}
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
  noTxText: {
    width: '95%',
    maxWidth: 250,
    textAlign: 'center',
    marginBottom: 30,
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
