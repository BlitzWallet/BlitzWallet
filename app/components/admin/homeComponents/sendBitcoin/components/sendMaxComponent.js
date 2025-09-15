import {useCallback, useMemo, useState} from 'react';
import {SATSPERBITCOIN} from '../../../../../constants/math';
import {crashlyticsLogReport} from '../../../../../functions/crashlyticsLogs';
import {sparkPaymenWrapper} from '../../../../../functions/spark/payments';
import {getLNAddressForLiquidPayment} from '../functions/payments';
import {calculateBoltzFeeNew} from '../../../../../functions/boltz/boltzFeeNew';
import {useActiveCustodyAccount} from '../../../../../../context-store/activeAccount';
import {useTranslation} from 'react-i18next';
import DropdownMenu from '../../../../../functions/CustomElements/dropdownMenu';
import {StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';

const MAX_SEND_OPTIONS = [
  {label: '25%', value: '25'},
  {label: '50%', value: '50'},
  {label: '75%', value: '75'},
  {label: '100%', value: '100'},
];
export default function SendMaxComponent({
  fiatStats,
  sparkInformation,
  paymentInfo,
  masterInfoObject,
  setPaymentInfo,
  paymentFee,
  paymentType,
  // minMaxLiquidSwapAmounts,
  seletctedToken,
  selectedLRC20Asset,
  useAltLayout,
}) {
  const navigate = useNavigation();
  const {t} = useTranslation();
  const [isGettingMax, setIsGettingMax] = useState(false);
  const {currentWalletMnemoinc} = useActiveCustodyAccount();

  const handleSelctProcesss = useCallback(
    async item => {
      try {
        if (isGettingMax) return;
        await new Promise(res => setTimeout(res, 250));
        const balance = seletctedToken?.balance || sparkInformation.balance;
        const selectedPercent = !item ? 100 : item.value;
        const sendingBalance = Math.round(balance * (selectedPercent / 100));
        console.log(selectedPercent, balance, sendingBalance);
        crashlyticsLogReport('Starting send max process');
        setIsGettingMax(true);

        // if (paymentInfo.type === 'liquid') {
        //   const supportFee =
        //     Math.ceil(
        //       Number(sendingBalance) *
        //         masterInfoObject?.enabledDeveloperSupport.baseFeePercent,
        //     ) + Number(masterInfoObject?.enabledDeveloperSupport?.baseFee);

        //   const boltzFee = calculateBoltzFeeNew(
        //     Number(sendingBalance),
        //     'ln-liquid',
        //     minMaxLiquidSwapAmounts.reverseSwapStats,
        //   );

        //   setPaymentInfo(prev => ({
        //     ...prev,
        //     sendAmount: String(
        //       Number(sendingBalance) - (supportFee + boltzFee) * 1.5,
        //     ),
        //   }));
        //   return;
        // }

        if (selectedLRC20Asset !== 'Bitcoin') {
          setPaymentInfo(prev => ({
            ...prev,
            sendAmount: String(sendingBalance),
          }));
        } else {
          let address = paymentInfo?.address;

          if (paymentInfo.type === 'lnUrlPay') {
            const invoice = await getLNAddressForLiquidPayment(
              paymentInfo,
              Number(sendingBalance),
            );
            address = invoice;
          }

          const feeResponse = await sparkPaymenWrapper({
            getFee: true,
            address: address,
            paymentType: paymentType.toLowerCase(),
            amountSats: Number(sendingBalance),
            masterInfoObject,
            seletctedToken: selectedLRC20Asset,
            mnemonic: currentWalletMnemoinc,
          });

          if (!feeResponse.didWork) throw new Error(feeResponse.error);

          const maxAmountSats =
            Number(sendingBalance) -
            (feeResponse.fee + feeResponse.supportFee) * 1.1;

          const convertedMax =
            masterInfoObject.userBalanceDenomination != 'fiat'
              ? Math.round(Number(maxAmountSats))
              : (
                  Number(maxAmountSats) /
                  Math.round(SATSPERBITCOIN / fiatStats?.value)
                ).toFixed(3);
          setPaymentInfo(prev => ({
            ...prev,
            sendAmount: String(convertedMax),
            feeQuote: feeResponse.feeQuote,
            paymentFee: feeResponse.fee,
            supportFee: feeResponse.supportFee,
          }));
        }
      } catch (err) {
        navigate.navigate('ErrorScreen', {errorMessage: err.message});
        console.log(err, 'ERROR');
      } finally {
        setIsGettingMax(false);
      }
    },
    [isGettingMax, seletctedToken, selectedLRC20Asset],
  );

  const memorizedDropdowntyles = useMemo(() => {
    return {
      flexShrink: useAltLayout ? 0 : 1,
      marginRight: useAltLayout ? 10 : 0,
      marginBottom: useAltLayout ? 0 : 20,
      alignSelf: useAltLayout ? 'auto' : 'center',
    };
  }, [useAltLayout]);

  const memorizedContainerStyles = useMemo(() => {
    return {
      flex: 0,
      borderRadius: useAltLayout ? 30 : 8,
      height: useAltLayout ? 50 : 'unset',
      minWidth: useAltLayout ? 70 : 'unset',
      justifyContent: 'center',
    };
  }, [useAltLayout]);
  return (
    <View style={memorizedDropdowntyles}>
      <DropdownMenu
        selectedValue={t(
          `wallet.sendPages.sendMaxComponent.${
            useAltLayout ? 'sendMaxShort' : 'sendMax'
          }`,
        )}
        onSelect={handleSelctProcesss}
        options={MAX_SEND_OPTIONS}
        showClearIcon={false}
        showVerticalArrows={false}
        customButtonStyles={memorizedContainerStyles}
        textStyles={styles.textStyles}
        useIsLoading={isGettingMax}
        disableDropdownPress={isGettingMax}
        customFunction={
          selectedLRC20Asset === 'Bitcoin' ? handleSelctProcesss : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  textStyles: {textAlign: 'center'},
  containerStyles: {
    flex: 0,
  },
});
