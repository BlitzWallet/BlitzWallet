import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Share,
} from 'react-native';
import {
  CENTER,
  SIZES,
  COLORS,
  SKELETON_ANIMATION_SPEED,
  APPROXIMATE_SYMBOL,
  HIDDEN_BALANCE_TEXT,
} from '../../constants';
import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { copyToClipboard, formatBalanceAmount } from '../../functions';
import { useGlobalContextProvider } from '../../../context-store/context';
import { ButtonsContainer } from '../../components/admin/homeComponents/receiveBitcoin';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../hooks/themeColors';
import { initializeAddressProcess } from '../../functions/receiveBitcoin/addressGeneration';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import QrCodeWrapper from '../../functions/CustomElements/QrWrapper';
import { useNodeContext } from '../../../context-store/nodeContext';
import { useAppStatus } from '../../../context-store/appStatus';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import { crashlyticsLogReport } from '../../functions/crashlyticsLogs';
import { useGlobalContacts } from '../../../context-store/globalContacts';
import { useLiquidEvent } from '../../../context-store/liquidEventContext';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useToast } from '../../../context-store/toastManager';
import { useRootstockProvider } from '../../../context-store/rootstockSwapContext';
import { encodeLNURL } from '../../functions/lnurl/bench32Formmater';
import { useLRC20EventContext } from '../../../context-store/lrc20Listener';
import { useActiveCustodyAccount } from '../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import { useWebView } from '../../../context-store/webViewContext';
import Animated, {
  runOnJS,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import SkeletonPlaceholder from '../../functions/CustomElements/skeletonView';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useFlashnet } from '../../../context-store/flashnetContext';
import { satsToDollars } from '../../functions/spark/flashnet';
import ThemeIcon from '../../functions/CustomElements/themeIcon';

export default function ReceivePaymentHome(props) {
  const navigate = useNavigation();
  const { fiatStats } = useNodeContext();
  const { sendWebViewRequest } = useWebView();
  const { swapLimits, poolInfoRef, swapUSDPriceDollars } = useFlashnet();
  const { sparkInformation, toggleNewestPaymentTimestamp } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { globalContactsInformation } = useGlobalContacts();
  const { minMaxLiquidSwapAmounts, screenDimensions } = useAppStatus();
  const { signer, startRootstockEventListener } = useRootstockProvider();
  // const { startLrc20EventListener } = useLRC20EventContext();
  const { t } = useTranslation();
  const { isUsingAltAccount, currentWalletMnemoinc } =
    useActiveCustodyAccount();
  const [contentHeight, setContentHeight] = useState(0);
  const { startLiquidEventListener } = useLiquidEvent();
  const userReceiveAmount = props.route.params?.receiveAmount || 0;
  const [initialSendAmount, setInitialSendAmount] = useState(userReceiveAmount);

  const paymentDescription = props.route.params?.description;
  const requestUUID = props.route.params?.uuid;
  const endReceiveType =
    props?.route.params.endReceiveType ||
    props?.route.params.initialReceiveType ||
    'BTC';
  useHandleBackPressNew();
  const selectedRecieveOption =
    props.route.params?.selectedRecieveOption || 'Lightning';

  const prevRequstInfo = useRef(null);
  const addressStateRef = useRef(null);

  const [addressState, setAddressState] = useState({
    selectedRecieveOption: selectedRecieveOption,
    isReceivingSwap: false,
    generatedAddress: isUsingAltAccount
      ? ''
      : `${globalContactsInformation.myProfile.uniqueName}@blitzwalletapp.com`,
    isGeneratingInvoice: false,
    minMaxSwapAmount: {
      min: 0,
      max: 0,
    },
    swapPegInfo: {},
    errorMessageText: {
      type: null,
      text: '',
    },
    hasGlobalError: false,
    fee: 0,
  });

  useEffect(() => {
    addressStateRef.current = addressState;
  }, [addressState]);

  useEffect(() => {
    async function runAddressInit() {
      crashlyticsLogReport('Begining adddress initialization');
      toggleNewestPaymentTimestamp();

      if (
        prevRequstInfo.current &&
        userReceiveAmount === prevRequstInfo.current.userReceiveAmount &&
        selectedRecieveOption.toLowerCase() ===
          prevRequstInfo.current.selectedRecieveOption.toLowerCase() &&
        paymentDescription === prevRequstInfo.current.paymentDescription &&
        !addressStateRef.current.errorMessageText.text &&
        endReceiveType === prevRequstInfo.current.endReceiveType
      ) {
        // This checks if we had a previous requst
        // And all other formation is the same
        // if the requst did not fail we block but if it did fail we rety since it failed
        return;
      }

      // Update prev request info to the new data
      prevRequstInfo.current = {
        userReceiveAmount,
        selectedRecieveOption,
        paymentDescription,
        endReceiveType,
      };
      if (
        !userReceiveAmount &&
        selectedRecieveOption.toLowerCase() === 'lightning' &&
        !isUsingAltAccount &&
        endReceiveType === 'BTC'
      ) {
        setInitialSendAmount(0);
        setAddressState(prev => ({
          ...prev,
          generatedAddress: `${globalContactsInformation.myProfile.uniqueName}@blitzwalletapp.com`,
        }));
        return;
      }

      await initializeAddressProcess({
        userBalanceDenomination: masterInfoObject.userBalanceDenomination,
        receivingAmount: userReceiveAmount,
        description: paymentDescription,
        masterInfoObject,
        // minMaxSwapAmounts: minMaxLiquidSwapAmounts,
        // mintURL: currentMintURL,
        setAddressState: setAddressState,
        selectedRecieveOption: selectedRecieveOption,
        navigate,
        signer,
        // eCashBalance,
        currentWalletMnemoinc,
        sendWebViewRequest,
        sparkInformation,
        endReceiveType,
        swapLimits,
        setInitialSendAmount,
        userReceiveAmount,
      });
      if (selectedRecieveOption === 'Liquid') {
        startLiquidEventListener(60);
      } else if (selectedRecieveOption === 'Rootstock') {
        startRootstockEventListener({ durationMs: 1200000 });
      }
    }
    runAddressInit();
  }, [
    userReceiveAmount,
    paymentDescription,
    selectedRecieveOption,
    requestUUID,
    endReceiveType,
  ]);

  const headerContext =
    selectedRecieveOption?.toLowerCase() === 'spark' ||
    selectedRecieveOption?.toLowerCase() === 'lightning'
      ? selectedRecieveOption?.toLowerCase() +
        `_${endReceiveType?.toLowerCase()}`
      : selectedRecieveOption?.toLowerCase();
  const handleShare = () => {
    if (!addressState.generatedAddress) return;
    if (addressState.isGeneratingInvoice) return;
    Share.share({
      message: addressState.generatedAddress,
    });
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        showLeftImage={true}
        iconNew="Share"
        leftImageFunction={handleShare}
        label={t('constants.receive')}
      />
      <ScrollView
        contentContainerStyle={{
          flexGrow: contentHeight > screenDimensions.height ? 0 : 1,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          onLayout={e => {
            if (!e.nativeEvent.layout.height) return;
            setContentHeight(e.nativeEvent.layout.height);
          }}
          style={{
            width: '100%',
            alignItems: 'center',
            flexGrow: contentHeight > screenDimensions.height ? 0 : 1,
          }}
        >
          <ThemeText
            styles={styles.title}
            content={t('screens.inAccount.receiveBtcPage.header', {
              context: headerContext,
            })}
          />
          <QrCode
            globalContactsInformation={globalContactsInformation}
            selectedRecieveOption={selectedRecieveOption}
            navigate={navigate}
            addressState={addressState}
            initialSendAmount={initialSendAmount || userReceiveAmount}
            masterInfoObject={masterInfoObject}
            fiatStats={fiatStats}
            isUsingAltAccount={isUsingAltAccount}
            t={t}
            endReceiveType={endReceiveType}
            swapLimits={swapLimits}
            poolInfoRef={poolInfoRef}
          />

          <ButtonsContainer
            generatingInvoiceQRCode={addressState.isGeneratingInvoice}
            generatedAddress={addressState.generatedAddress}
            selectedRecieveOption={selectedRecieveOption}
            initialSendAmount={initialSendAmount || userReceiveAmount}
            isUsingAltAccount={isUsingAltAccount}
          />

          <View style={{ marginBottom: 'auto' }}></View>

          <TouchableOpacity
            activeOpacity={
              (selectedRecieveOption.toLowerCase() !== 'lightning' ||
                (selectedRecieveOption.toLowerCase() === 'lightning' &&
                  endReceiveType === 'USD')) &&
              selectedRecieveOption.toLowerCase() !== 'spark'
                ? 0.2
                : 1
            }
            onPress={() => {
              if (
                (selectedRecieveOption.toLowerCase() === 'lightning' &&
                  endReceiveType !== 'USD') ||
                selectedRecieveOption.toLowerCase() === 'spark'
              )
                return;

              let informationText = '';
              if (selectedRecieveOption.toLowerCase() === 'bitcoin') {
                informationText = t(
                  'screens.inAccount.receiveBtcPage.onchainFeeMessage',
                );
              } else if (selectedRecieveOption.toLowerCase() === 'liquid') {
                informationText = t(
                  'screens.inAccount.receiveBtcPage.liquidFeeMessage',
                  {
                    fee: displayCorrectDenomination({
                      amount: 34,
                      masterInfoObject,
                      fiatStats,
                    }),
                    claimFee: displayCorrectDenomination({
                      amount: 19,
                      masterInfoObject,
                      fiatStats,
                    }),
                  },
                );
              } else if (selectedRecieveOption.toLowerCase() === 'rootstock') {
                informationText = t(
                  'screens.inAccount.receiveBtcPage.rootstockFeeMessage',
                  {
                    fee: displayCorrectDenomination({
                      amount:
                        (minMaxLiquidSwapAmounts?.rsk?.submarine?.fees
                          ?.minerFees?.claim || 64) +
                        (minMaxLiquidSwapAmounts?.rsk?.submarine?.fees
                          ?.minerFees?.lockup || 121),
                      masterInfoObject,
                      fiatStats,
                    }),
                  },
                );
              } else if (selectedRecieveOption.toLowerCase() === 'lightning') {
                informationText = t(
                  'screens.inAccount.receiveBtcPage.lightningConvertMessage',
                  {
                    convertFee: formatBalanceAmount(
                      poolInfoRef.lpFeeBps / 100 + 1,
                      false,
                      masterInfoObject,
                    ),
                    satExchangeRate: displayCorrectDenomination({
                      amount: Number(swapUSDPriceDollars).toFixed(2),
                      masterInfoObject: {
                        ...masterInfoObject,
                        userBalanceDenomination: 'fiat',
                      },
                      fiatStats,
                      forceCurrency: 'USD',
                      convertAmount: false,
                    }),
                    dollarAmount: displayCorrectDenomination({
                      amount: 1,
                      masterInfoObject: {
                        ...masterInfoObject,
                        userBalanceDenomination: 'fiat',
                      },
                      fiatStats,
                      forceCurrency: 'USD',
                      convertAmount: false,
                    }),
                  },
                );
              }
              navigate.navigate('InformationPopup', {
                textContent: informationText,
                buttonText: t('constants.understandText'),
              });
            }}
            style={{
              alignItems: 'center',
            }}
          >
            <View style={styles.feeTitleContainer}>
              <ThemeText
                styles={styles.feeTitleText}
                content={t('constants.fee')}
              />
              {(selectedRecieveOption.toLowerCase() !== 'lightning' ||
                (selectedRecieveOption.toLowerCase() === 'lightning' &&
                  endReceiveType === 'USD')) &&
                selectedRecieveOption.toLowerCase() !== 'spark' && (
                  <ThemeIcon
                    size={15}
                    styles={{ marginLeft: 5 }}
                    iconName={'Info'}
                  />
                )}
            </View>
            {(selectedRecieveOption.toLowerCase() !== 'lightning' ||
              (selectedRecieveOption.toLowerCase() === 'lightning' &&
                endReceiveType === 'USD')) &&
            selectedRecieveOption.toLowerCase() !== 'spark' ? (
              <ThemeText content={t('constants.veriable')} />
            ) : (
              <FormattedSatText
                neverHideBalance={true}
                styles={{ paddingBottom: 5 }}
                balance={0}
              />
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </GlobalThemeView>
  );
}

function QrCode(props) {
  const {
    addressState,
    navigate,
    selectedRecieveOption,
    globalContactsInformation,
    initialSendAmount,
    masterInfoObject,
    fiatStats,
    isUsingAltAccount,
    t,
    endReceiveType,
    swapLimits,
    poolInfoRef,
  } = props;
  const { showToast } = useToast();
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset, textColor } = GetThemeColors();

  const isUsingLnurl =
    selectedRecieveOption.toLowerCase() === 'lightning' &&
    !initialSendAmount &&
    !isUsingAltAccount &&
    endReceiveType === 'BTC';

  const qrOpacity = useSharedValue(addressState.generatedAddress ? 1 : 0);
  const loadingOpacity = useSharedValue(isUsingLnurl ? 0 : 1);
  const previousAddress = useRef(addressState.generatedAddress);
  const fadeOutDuration = 200;
  const fadeInDuration = 200;

  useEffect(() => {
    const newAddress = addressState.generatedAddress;
    const hasChanged = newAddress !== previousAddress.current;

    if (addressState.errorMessageText?.text) {
      loadingOpacity.value = 0;
      qrOpacity.value = 0;
      return;
    }

    if (hasChanged && previousAddress.current) {
      qrOpacity.value = withTiming(
        0,
        { duration: fadeOutDuration },
        finished => {
          if (finished) {
            runOnJS(handleFadeOutComplete)(newAddress);
          }
        },
      );
    } else if (newAddress && !previousAddress.current) {
      previousAddress.current = newAddress;
      loadingOpacity.value = 0;
      qrOpacity.value = withTiming(1, { duration: fadeInDuration });
    } else if (
      !newAddress &&
      !addressState.isGeneratingInvoice &&
      previousAddress.current
    ) {
      qrOpacity.value = withTiming(0, { duration: fadeOutDuration });
      loadingOpacity.value = 0;
      previousAddress.current = '';
    } else if (newAddress) {
      // if we have an address just show the qr code
      loadingOpacity.value = 0;
      qrOpacity.value = withTiming(1, { duration: fadeInDuration });
    }
  }, [
    addressState.generatedAddress,
    addressState.isGeneratingInvoice,
    addressState.errorMessageText?.text,
  ]);

  const handleFadeOutComplete = newAddress => {
    if (newAddress) {
      previousAddress.current = newAddress;
      loadingOpacity.value = 0;
      qrOpacity.value = withTiming(1, { duration: fadeInDuration });
    } else if (addressState.isGeneratingInvoice) {
      previousAddress.current = '';
      loadingOpacity.value = withTiming(1, { duration: fadeInDuration });
    } else {
      previousAddress.current = '';
      loadingOpacity.value = 0;
    }
  };

  const handlePress = () => {
    if (!addressState.generatedAddress) return;
    if (addressState.isGeneratingInvoice) return;
    copyToClipboard(addressState.generatedAddress, showToast);
  };

  const address =
    (isUsingLnurl
      ? `${globalContactsInformation?.myProfile?.uniqueName}@blitzwalletapp.com`
      : addressState.generatedAddress) || '';

  const canUseAmount =
    selectedRecieveOption?.toLowerCase() !== 'spark' &&
    selectedRecieveOption?.toLowerCase() !== 'rootstock';

  const canConvert =
    selectedRecieveOption?.toLowerCase() === 'spark' ||
    selectedRecieveOption?.toLowerCase() === 'lightning';

  const showLongerAddress =
    (selectedRecieveOption?.toLowerCase() === 'bitcoin' ||
      selectedRecieveOption?.toLowerCase() === 'liquid') &&
    !!initialSendAmount;

  const editAmount = () => {
    navigate.navigate('EditReceivePaymentInformation', {
      from: 'receivePage',
      receiveType: selectedRecieveOption,
      endReceiveType,
    });
  };

  const selectReceiveTypeAsset = () => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'SelectReceiveAsset',
      endReceiveType,
      selectedRecieveOption: selectedRecieveOption?.toLowerCase(),
      sliderHight: 0.5,
    });
  };

  const qrData = isUsingLnurl
    ? encodeLNURL(globalContactsInformation?.myProfile?.uniqueName)
    : addressState.generatedAddress || previousAddress.current || ' ';

  const invoiceContext =
    selectedRecieveOption.toLowerCase() === 'lightning'
      ? !isUsingLnurl
        ? 'lightningInvoice'
        : 'lightningAddress'
      : `${selectedRecieveOption.toLowerCase()}Address`;

  const approximateUSDAmount = ` ${APPROXIMATE_SYMBOL} ${displayCorrectDenomination(
    {
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: 'fiat',
      },
      forceCurrency: 'USD',
      fiatStats: fiatStats,
      amount: formatBalanceAmount(
        (
          satsToDollars(initialSendAmount, poolInfoRef?.currentPriceAInB) *
          (1 - (poolInfoRef.lpFeeBps / 100 + 1) / 100)
        ).toFixed(2),
        false,
        masterInfoObject,
      ),
      convertAmount: false,
    },
  )}`;

  return (
    <View
      style={[styles.qrCodeContainer, { backgroundColor: backgroundOffset }]}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={styles.qrCodeContainer}
      >
        <View style={styles.animatedQRContainer}>
          {!addressState.errorMessageText?.text ? (
            <>
              <Animated.View
                style={{
                  position: 'absolute',
                  opacity: qrOpacity,
                }}
              >
                <QrCodeWrapper
                  outerContainerStyle={{ backgroundColor: 'transparent' }}
                  QRData={qrData}
                />
              </Animated.View>

              <Animated.View
                style={{
                  position: 'absolute',
                  width: 300,
                  height: 300,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: loadingOpacity,
                }}
              >
                <FullLoadingScreen showText={false} />
              </Animated.View>
            </>
          ) : (
            <View
              style={{
                position: 'absolute',
                width: 300,
                height: 300,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 10,
                zIndex: 99,
                backgroundColor: backgroundOffset,
              }}
            >
              <ThemeText
                styles={styles.errorText}
                content={
                  t(addressState.errorMessageText.text) ||
                  t('errormessages.invoiceRetrivalError')
                }
              />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {canConvert && (
        <QRInformationRow
          title={t('screens.inAccount.receiveBtcPage.receiveAsHeader')}
          info={t(
            `screens.inAccount.receiveBtcPage.receiveAs_${selectedRecieveOption?.toLowerCase()}_${endReceiveType}`,
          )}
          iconName={'ChevronDown'}
          showBoder={true}
          rotateIcon={true}
          actionFunction={selectReceiveTypeAsset}
        />
      )}

      {canUseAmount && (
        <QRInformationRow
          title={t('constants.amount')}
          info={
            !initialSendAmount
              ? t('screens.inAccount.receiveBtcPage.amountPlaceholder')
              : endReceiveType === 'USD' &&
                initialSendAmount === swapLimits.bitcoin &&
                canConvert
              ? t('screens.inAccount.receiveBtcPage.amount_USD_MIN', {
                  swapAmountSat: displayCorrectDenomination({
                    masterInfoObject: masterInfoObject,
                    fiatStats: fiatStats,
                    amount: initialSendAmount,
                  }),
                }) + approximateUSDAmount
              : displayCorrectDenomination({
                  masterInfoObject: masterInfoObject,
                  fiatStats: fiatStats,
                  amount: initialSendAmount,
                }) +
                (endReceiveType === 'USD' && canConvert
                  ? approximateUSDAmount
                  : '')
          }
          iconName={'SquarePen'}
          showBoder={true}
          actionFunction={editAmount}
        />
      )}
      <QRInformationRow
        title={t('screens.inAccount.receiveBtcPage.invoiceDescription', {
          context: invoiceContext,
        })}
        info={
          isUsingLnurl
            ? address
            : address.slice(0, showLongerAddress ? 14 : 7) +
              '...' +
              address.slice(address.length - 7)
        }
        iconName={'Copy'}
        actionFunction={() => {
          if (addressState.isGeneratingInvoice) return;
          // if (isUsingLnurl) editLNURL();
          if (addressState.generatedAddress)
            copyToClipboard(address, showToast);
        }}
        showSkeleton={addressState.isGeneratingInvoice}
      />
    </View>
  );
}

function QRInformationRow({
  title = '',
  info = '',
  lightModeIcon,
  darkModeIcon,
  lightsOutIcon,
  showBoder,
  actionFunction,
  showSkeleton = false,
  rotateIcon = false,
  iconName,
}) {
  const { backgroundColor, textColor } = GetThemeColors();
  return (
    <TouchableOpacity
      style={[
        styles.qrInfoContainer,
        {
          borderBottomWidth: showBoder ? 2 : 0,
          borderBottomColor: backgroundColor,
        },
      ]}
      onPress={() => {
        if (actionFunction) actionFunction();
      }}
    >
      <View style={styles.infoTextContiner}>
        <ThemeText
          styles={{ includeFontPadding: false, fontSize: SIZES.small }}
          content={title}
        />
        {showSkeleton ? (
          <SkeletonPlaceholder
            highlightColor={backgroundColor}
            backgroundColor={COLORS.opaicityGray}
            enabled={true}
            speed={SKELETON_ANIMATION_SPEED}
          >
            <View
              style={{
                width: '100%',
                height: SIZES.small,
                marginVertical: 3,
                borderRadius: 8,
              }}
            ></View>
          </SkeletonPlaceholder>
        ) : (
          <ThemeText
            CustomNumberOfLines={1}
            styles={{
              includeFontPadding: false,
              fontSize: SIZES.small,
              opacity: 0.6,
              flexShrink: 1,
            }}
            content={info}
          />
        )}
      </View>
      <View
        style={{
          width: 30,
          height: 30,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
        }}
      >
        <ThemeIcon colorOverride={textColor} size={15} iconName={iconName} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 10,
    marginTop: 'auto',
    opacity: 0.7,
    includeFontPadding: false,
  },
  animatedQRContainer: {
    position: 'relative',
    alignItems: 'center',
    width: 300,
    height: 300,
  },
  qrCodeContainer: {
    width: 300,
    height: 'auto',
    minHeight: 300,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  errorText: {
    width: '90%',
    fontSize: SIZES.medium,
    textAlign: 'center',
    marginTop: 20,
  },

  secondaryButton: {
    width: 'auto',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    ...CENTER,
  },

  feeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feeTitleText: {
    includeFontPadding: false,
  },
  AboutIcon: {
    width: 15,
    height: 15,
    marginLeft: 5,
  },

  qrInfoContainer: {
    width: 275,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
  },
  infoTextContiner: { width: '100%', flexShrink: 1, marginRight: 10 },
  dollarPrice: {
    textAlign: 'center',
    fontSize: SIZES.smedium,
    opacity: HIDDEN_BALANCE_TEXT,
    marginTop: 12,
    lineHeight: 16,
    maxWidth: 250,
    ...CENTER,
  },
});
