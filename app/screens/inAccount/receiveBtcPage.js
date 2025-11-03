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
  ICONS,
  COLORS,
  SKELETON_ANIMATION_SPEED,
} from '../../constants';
import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { copyToClipboard } from '../../functions';
import { useGlobalContextProvider } from '../../../context-store/context';
import { ButtonsContainer } from '../../components/admin/homeComponents/receiveBitcoin';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../hooks/themeColors';
import ThemeImage from '../../functions/CustomElements/themeImage';
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

export default function ReceivePaymentHome(props) {
  const navigate = useNavigation();
  const { fiatStats } = useNodeContext();
  const { sendWebViewRequest } = useWebView();

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
  const initialSendAmount = props.route.params?.receiveAmount || 0;
  const paymentDescription = props.route.params?.description;
  useHandleBackPressNew();
  const selectedRecieveOption =
    props.route.params?.selectedRecieveOption || 'Lightning';

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
    async function runAddressInit() {
      crashlyticsLogReport('Begining adddress initialization');
      if (
        !initialSendAmount &&
        selectedRecieveOption.toLowerCase() === 'lightning' &&
        !isUsingAltAccount
      ) {
        setAddressState(prev => ({
          ...prev,
          generatedAddress: `${globalContactsInformation.myProfile.uniqueName}@blitzwalletapp.com`,
        }));
        return;
      }

      await initializeAddressProcess({
        userBalanceDenomination: masterInfoObject.userBalanceDenomination,
        receivingAmount: initialSendAmount,
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
      });
      if (selectedRecieveOption === 'Liquid') {
        startLiquidEventListener();
      } else if (selectedRecieveOption === 'Rootstock') {
        startRootstockEventListener({ durationMs: 1200000 });
      }
      // else if (
      //   selectedRecieveOption === 'Spark' &&
      //   masterInfoObject.lrc20Settings?.isEnabled
      // ) {
      //   startLrc20EventListener(12);
      // }
    }
    runAddressInit();
  }, [initialSendAmount, paymentDescription, selectedRecieveOption]);

  const handleShare = () => {
    if (!addressState.generatedAddress) return;
    if (addressState.isGeneratingInvoice) return;
    Share.share({
      message: addressState.generatedAddress,
    });
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
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
          <CustomSettingsTopBar
            showLeftImage={true}
            leftImageBlue={ICONS.share}
            LeftImageDarkMode={ICONS.shareWhite}
            leftImageFunction={handleShare}
          />

          <ThemeText styles={styles.title} content={selectedRecieveOption} />
          <QrCode
            globalContactsInformation={globalContactsInformation}
            selectedRecieveOption={selectedRecieveOption}
            navigate={navigate}
            addressState={addressState}
            initialSendAmount={initialSendAmount}
            masterInfoObject={masterInfoObject}
            fiatStats={fiatStats}
            isUsingAltAccount={isUsingAltAccount}
            t={t}
          />

          <ButtonsContainer
            generatingInvoiceQRCode={addressState.isGeneratingInvoice}
            generatedAddress={addressState.generatedAddress}
            selectedRecieveOption={selectedRecieveOption}
            initialSendAmount={initialSendAmount}
            isUsingAltAccount={isUsingAltAccount}
          />

          <View style={{ marginBottom: 'auto' }}></View>

          <TouchableOpacity
            activeOpacity={
              selectedRecieveOption.toLowerCase() !== 'lightning' &&
              selectedRecieveOption.toLowerCase() !== 'spark'
                ? 0.2
                : 1
            }
            onPress={() => {
              if (
                selectedRecieveOption.toLowerCase() === 'lightning' ||
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
              {selectedRecieveOption.toLowerCase() !== 'lightning' &&
                selectedRecieveOption.toLowerCase() !== 'spark' && (
                  <ThemeImage
                    styles={styles.AboutIcon}
                    lightModeIcon={ICONS.aboutIcon}
                    darkModeIcon={ICONS.aboutIcon}
                    lightsOutIcon={ICONS.aboutIconWhite}
                  />
                )}
            </View>
            {selectedRecieveOption.toLowerCase() !== 'lightning' &&
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
  } = props;
  const { showToast } = useToast();
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset, textColor } = GetThemeColors();

  const qrOpacity = useSharedValue(addressState.generatedAddress ? 1 : 0);
  const loadingOpacity = useSharedValue(0);
  const previousAddress = useRef(addressState.generatedAddress);
  const fadeOutDuration = 200;
  const fadeInDuration = 200;

  useEffect(() => {
    const newAddress = addressState.generatedAddress;
    const hasChanged = newAddress !== previousAddress.current;

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
    }
  }, [addressState.generatedAddress, addressState.isGeneratingInvoice]);

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
    (selectedRecieveOption.toLowerCase() === 'lightning' &&
    !initialSendAmount &&
    !isUsingAltAccount
      ? `${globalContactsInformation?.myProfile?.uniqueName}@blitzwalletapp.com`
      : addressState.generatedAddress) || '';

  const canUseAmount =
    selectedRecieveOption?.toLowerCase() !== 'spark' &&
    selectedRecieveOption?.toLowerCase() !== 'rootstock';

  const showLongerAddress =
    (selectedRecieveOption?.toLowerCase() === 'bitcoin' ||
      selectedRecieveOption?.toLowerCase() === 'liquid') &&
    initialSendAmount;

  const editAmount = () => {
    navigate.navigate('EditReceivePaymentInformation', {
      from: 'receivePage',
      receiveType: selectedRecieveOption,
    });
  };

  const editLNURL = () => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'editLNURLOnReceive',
    });
  };

  const qrData =
    selectedRecieveOption.toLowerCase() === 'lightning' &&
    !initialSendAmount &&
    !isUsingAltAccount
      ? encodeLNURL(globalContactsInformation?.myProfile?.uniqueName)
      : addressState.generatedAddress || previousAddress.current || ' ';

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

          {!addressState.errorMessageText?.text ? (
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
              <FullLoadingScreen
                text={t('screens.inAccount.receiveBtcPage.generatingInvoice')}
              />
            </Animated.View>
          ) : (
            <Animated.View
              style={{
                position: 'absolute',
                width: 300,
                height: 300,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 10,
              }}
            >
              <ThemeText
                styles={styles.errorText}
                content={
                  t(addressState.errorMessageText.text) ||
                  t('errormessages.invoiceRetrivalError')
                }
              />
            </Animated.View>
          )}
        </View>
      </TouchableOpacity>

      {canUseAmount && (
        <QRInformationRow
          title={t('constants.amount')}
          info={displayCorrectDenomination({
            masterInfoObject: masterInfoObject,
            fiatStats: fiatStats,
            amount: initialSendAmount,
          })}
          lightModeIcon={ICONS.editIcon}
          darkModeIcon={ICONS.editIconLight}
          lightsOutIcon={ICONS.editIconLight}
          showBoder={true}
          actionFunction={editAmount}
        />
      )}
      <QRInformationRow
        title={`${selectedRecieveOption} ${
          selectedRecieveOption.toLowerCase() === 'lightning' &&
          (initialSendAmount || isUsingAltAccount)
            ? t('constants.invoice')?.toLowerCase()
            : t('constants.address')?.toLowerCase()
        }`}
        info={
          selectedRecieveOption.toLowerCase() === 'lightning' &&
          !initialSendAmount &&
          !isUsingAltAccount
            ? address
            : address.slice(0, showLongerAddress ? 14 : 7) +
              '...' +
              address.slice(address.length - 7)
        }
        lightModeIcon={
          selectedRecieveOption.toLowerCase() === 'lightning' &&
          !initialSendAmount &&
          !isUsingAltAccount
            ? ICONS.editIcon
            : ICONS.clipboardDark
        }
        darkModeIcon={
          selectedRecieveOption.toLowerCase() === 'lightning' &&
          !initialSendAmount &&
          !isUsingAltAccount
            ? ICONS.editIconLight
            : ICONS.clipboardLight
        }
        lightsOutIcon={
          selectedRecieveOption.toLowerCase() === 'lightning' &&
          !initialSendAmount &&
          !isUsingAltAccount
            ? ICONS.editIconLight
            : ICONS.clipboardLight
        }
        actionFunction={() => {
          if (addressState.isGeneratingInvoice) return;
          if (
            selectedRecieveOption.toLowerCase() === 'lightning' &&
            !initialSendAmount &&
            !isUsingAltAccount
          )
            editLNURL();
          else if (addressState.generatedAddress)
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
}) {
  const { backgroundColor } = GetThemeColors();
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
        <ThemeImage
          styles={{ width: 15, height: 15 }}
          lightModeIcon={lightModeIcon}
          darkModeIcon={darkModeIcon}
          lightsOutIcon={lightsOutIcon}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 10,
    marginTop: 'auto',
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
});
