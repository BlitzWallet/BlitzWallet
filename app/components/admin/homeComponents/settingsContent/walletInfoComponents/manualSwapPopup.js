import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import {useNavigation} from '@react-navigation/native';
import {useEffect, useRef, useState} from 'react';

import {
  CENTER,
  COLORS,
  FONT,
  ICONS,
  LIQUID_DEFAULT_FEE,
  SATSPERBITCOIN,
  SIZES,
} from '../../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import {nodeInfo, parseInput} from '@breeztech/react-native-breez-sdk';
import {getInfo} from '@breeztech/react-native-breez-sdk-liquid';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import Icon from '../../../../../functions/CustomElements/Icon';
import {useGlobaleCash} from '../../../../../../context-store/eCash';
import {calculateBoltzFeeNew} from '../../../../../functions/boltz/boltzFeeNew';
import {breezLiquidPaymentWrapper} from '../../../../../functions/breezLiquid';
import {breezPaymentWrapper} from '../../../../../functions/SDK';
import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../../context-store/appStatus';

export default function ManualSwapPopup() {
  const navigate = useNavigation();
  const {masterInfoObject} = useGlobalContextProvider();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const [sendingAmount, setSendingAmount] = useState('');
  const [userBalanceInformation, setUserBalanceInformation] = useState({});
  const [transferInfo, setTransferInfo] = useState({from: '', to: ''});
  const [isDoingTransfer, setIsDoingTransfer] = useState(false);
  const {ecashWalletInformation} = useGlobaleCash();
  const eCashBalance = ecashWalletInformation.balance;

  const convertedSendAmount =
    masterInfoObject.userBalanceDenomination != 'fiat'
      ? Math.round(Number(sendingAmount))
      : Math.round(
          (SATSPERBITCOIN / nodeInformation?.fiatStats?.value) *
            Number(sendingAmount),
        );

  console.log(masterInfoObject.userBalanceDenomination, 'TESTING');

  const maxTransferAmountFromBalance =
    transferInfo.from.toLowerCase() === 'bank'
      ? userBalanceInformation.lightningInboundAmount >
        userBalanceInformation.liquidBalance
        ? userBalanceInformation.liquidBalance - 5
        : userBalanceInformation.lightningInboundAmount - 5
      : transferInfo.from.toLowerCase() === 'ecash'
      ? eCashBalance - 5
      : userBalanceInformation.lightningBalance - 5;

  const lnFee = Math.round(maxTransferAmountFromBalance * 0.005) + 4;
  const maxAmountCaluclation =
    maxTransferAmountFromBalance > minMaxLiquidSwapAmounts.max
      ? minMaxLiquidSwapAmounts.max -
        calculateBoltzFeeNew(
          maxTransferAmountFromBalance,
          transferInfo.from.toLowerCase() === 'bank'
            ? 'liquid-ln'
            : 'ln-liquid',
          minMaxLiquidSwapAmounts[
            transferInfo.from.toLowerCase() === 'bank'
              ? 'submarineSwapStats'
              : 'reverseSwapStats'
          ],
        )
      : maxTransferAmountFromBalance -
        calculateBoltzFeeNew(
          maxTransferAmountFromBalance,
          transferInfo.from.toLowerCase() === 'bank'
            ? 'liquid-ln'
            : 'ln-liquid',
          minMaxLiquidSwapAmounts[
            transferInfo.from.toLowerCase() === 'bank'
              ? 'submarineSwapStats'
              : 'reverseSwapStats'
          ],
        );

  const maxTransferAmount =
    transferInfo.from.toLowerCase() === 'lightning'
      ? maxAmountCaluclation - lnFee
      : transferInfo.from.toLowerCase() === 'bank'
      ? maxAmountCaluclation - LIQUID_DEFAULT_FEE
      : maxAmountCaluclation - 5;

  const canDoTransfer =
    maxTransferAmount >= minMaxLiquidSwapAmounts.min &&
    convertedSendAmount < maxTransferAmount &&
    convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
    convertedSendAmount <= minMaxLiquidSwapAmounts.max;

  console.log(
    calculateBoltzFeeNew(
      convertedSendAmount,
      transferInfo.from.toLowerCase() === 'bank' ? 'liquid-ln' : 'ln-liquid',
      minMaxLiquidSwapAmounts[
        transferInfo.from.toLowerCase() === 'bank'
          ? 'submarineSwapStats'
          : 'reverseSwapStats'
      ],
    ),
  );
  useEffect(() => {
    async function loadUserBalanceInformation() {
      const node_info = await nodeInfo();
      const liquid_info = await getInfo();

      setUserBalanceInformation({
        lightningInboundAmount: node_info.totalInboundLiquidityMsats / 1000,
        lightningBalance: node_info.channelsBalanceMsat / 1000,
        liquidBalance: liquid_info.walletInfo.balanceSat,
        ecashBalance: eCashBalance,
      });
    }
    loadUserBalanceInformation();
  }, []);
  console.log(userBalanceInformation);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : null}
        style={{flex: 1}}>
        <View style={styles.topbar}>
          <TouchableOpacity
            style={{position: 'absolute', top: 0, left: 0, zIndex: 1}}
            onPress={() => {
              navigate.goBack();
            }}>
            <ThemeImage
              lightsOutIcon={ICONS.arrow_small_left_white}
              darkModeIcon={ICONS.smallArrowLeft}
              lightModeIcon={ICONS.smallArrowLeft}
            />
          </TouchableOpacity>
          <ThemeText
            CustomEllipsizeMode={'tail'}
            CustomNumberOfLines={1}
            content={'Internal transfer'}
            styles={{...styles.topBarText}}
          />
        </View>
        {!Object.keys(userBalanceInformation).length || isDoingTransfer ? (
          <FullLoadingScreen
            textStyles={{textAlign: 'center'}}
            text={
              isDoingTransfer
                ? 'Handling transfer, please do not leave the page.'
                : ''
            }
          />
        ) : (
          <>
            <ScrollView style={{width: '100%', flex: 1}}>
              <View style={styles.transferAccountRow}>
                <ThemeText content={'Transfer from:'} />
                <TouchableOpacity
                  onPress={() =>
                    navigate.navigate('AccountInformationPage', {
                      setTransferInfo: setTransferInfo,
                      transferType: 'from',
                      userBalanceInformation: userBalanceInformation,
                    })
                  }
                  style={styles.chooseAccountBTN}>
                  <ThemeText
                    content={
                      !transferInfo.from
                        ? 'Select from account'
                        : transferInfo.from
                    }
                  />
                  <ThemeImage
                    styles={styles.chooseAccountImage}
                    lightModeIcon={ICONS.leftCheveronIcon}
                    darkModeIcon={ICONS.leftCheveronIcon}
                    lightsOutIcon={ICONS.left_cheveron_white}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.transferAccountRow}>
                <ThemeText content={'Transfer to:'} />
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.chooseAccountBTN}>
                  <ThemeText
                    content={!transferInfo.to ? '* * * * *' : transferInfo.to}
                  />
                </TouchableOpacity>
              </View>
              <FormattedBalanceInput
                customTextInputContainerStyles={{marginTop: 20}}
                maxWidth={0.9}
                amountValue={sendingAmount}
                inputDenomination={masterInfoObject.userBalanceDenomination}
              />

              <FormattedSatText
                containerStyles={{opacity: !sendingAmount ? 0.5 : 1}}
                neverHideBalance={true}
                styles={{includeFontPadding: false}}
                globalBalanceDenomination={
                  masterInfoObject.userBalanceDenomination === 'sats' ||
                  masterInfoObject.userBalanceDenomination === 'hidden'
                    ? 'fiat'
                    : 'sats'
                }
                balance={convertedSendAmount}
              />
            </ScrollView>
            {transferInfo.from && transferInfo.to && (
              <FormattedSatText
                frontText={`${
                  convertedSendAmount < minMaxLiquidSwapAmounts.min
                    ? 'Minimum'
                    : 'Maximum'
                } transfer amount is  `}
                balance={
                  convertedSendAmount < minMaxLiquidSwapAmounts.min
                    ? minMaxLiquidSwapAmounts.min
                    : maxTransferAmount
                }
                styles={{textAlign: 'center'}}
                containerStyles={{
                  marginBottom: 10,
                  width: '100%',
                  flexWrap: 'wrap',
                  ...CENTER,
                }}
              />
            )}

            <CustomNumberKeyboard
              showDot={masterInfoObject.userBalanceDenomination === 'fiat'}
              frompage="sendContactsPage"
              setInputValue={setSendingAmount}
              usingForBalance={true}
              nodeInformation={nodeInformation}
            />

            <CustomButton
              textContent={'Confirm'}
              buttonStyles={{
                ...CENTER,
                opacity:
                  !transferInfo.from ||
                  !transferInfo.to ||
                  !canDoTransfer ||
                  !sendingAmount
                    ? 0.2
                    : 1,
              }}
              actionFunction={() => {
                if (!transferInfo.from || !transferInfo.to) return;
                if (!canDoTransfer) return;
                if (!sendingAmount) return;
                navigate.navigate('CustomHalfModal', {
                  wantedContent: 'confirmInternalTransferHalfModal',
                  amount: convertedSendAmount,
                  transferInfo: transferInfo,
                  startTransferFunction: initiateTransfer,
                  sliderHight: 0.5,
                });
              }}
            />
          </>
        )}
      </KeyboardAvoidingView>
    </GlobalThemeView>
  );
  async function initiateTransfer({invoice, transferInfo}) {
    try {
      setIsDoingTransfer(true);
      if (transferInfo.from.toLowerCase() === 'lightning') {
        const parsedInvoice = await parseInput(invoice);
        await breezPaymentWrapper({
          paymentInfo: parsedInvoice,
          paymentDescription: 'Internal_Transfer',
          failureFunction: response => {
            navigate.reset({
              index: 0, // The top-level route index
              routes: [
                {
                  name: 'HomeAdmin',
                  params: {screen: 'Home'},
                },
                {
                  name: 'ConfirmTxPage',
                  params: {
                    for: 'paymentFailed',
                    information: response,
                    formattingType: 'lightningNode',
                  },
                },
              ],
            });
          },
          confirmFunction: response => {
            navigate.reset({
              index: 0, // The top-level route index
              routes: [
                {
                  name: 'HomeAdmin',
                  params: {screen: 'Home'},
                },
                {
                  name: 'ConfirmTxPage',
                  params: {
                    for: 'paymentSucceed',
                    information: response,
                    formattingType: 'lightningNode',
                  },
                },
              ],
            });
          },
        });
      } else if (transferInfo.from.toLowerCase() === 'ecash') {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'eCash transfers are not set up yet',
        });
      } else {
        const paymentResponse = await breezLiquidPaymentWrapper({
          invoice: invoice,
          paymentType: 'bolt11',
        });
        if (!paymentResponse.didWork) {
          navigate.reset({
            index: 0, // The top-level route index
            routes: [
              {
                name: 'HomeAdmin',
                params: {screen: 'Home'},
              },
              {
                name: 'ConfirmTxPage',
                params: {
                  for: 'paymentFailed',
                  information: {
                    details: {
                      error: paymentResponse.error,
                      amountSat: convertedSendAmount,
                    },
                  },
                  formattingType: 'liquidNode',
                },
              },
            ],
          });
          return;
        }
        const {payment, fee} = paymentResponse;
        navigate.reset({
          index: 0, // The top-level route index
          routes: [
            {
              name: 'HomeAdmin',
              params: {screen: 'Home'},
            },
            {
              name: 'ConfirmTxPage',
              params: {
                for: 'paymentSucceed',
                information: payment,
                formattingType: 'liquidNode',
              },
            },
          ],
        });
      }
    } catch (err) {
      console.log(err, 'TRANSFER ERROR');
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Unable to perform transfer',
      });
    }
  }
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarText: {
    fontSize: SIZES.xLarge,
    width: '100%',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.halfModalBackgroundColor,
  },
  absolute: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  contentContainer: {
    width: '90%',
    backgroundColor: COLORS.darkModeText,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  transferAccountRow: {
    width: '90%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    alignItems: 'center',
    ...CENTER,
  },
  chooseAccountBTN: {
    flexDirection: 'row',
    alignItems: 'center',
    includeFontPadding: false,
  },
  chooseAccountImage: {
    height: 20,
    width: 10,
    transform: [{rotate: '180deg'}],
    marginLeft: 5,
  },
  textInputContainer: {
    margin: 0,
    marginTop: 10,
    ...CENTER,
  },
});
