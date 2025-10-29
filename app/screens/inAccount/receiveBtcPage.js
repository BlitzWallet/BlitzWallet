import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { CENTER, SIZES, ICONS, COLORS } from '../../constants';
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

export default function ReceivePaymentHome(props) {
  const navigate = useNavigation();
  const { fiatStats } = useNodeContext();
  const { sendWebViewRequest } = useWebView();

  const { masterInfoObject } = useGlobalContextProvider();
  const { globalContactsInformation } = useGlobalContacts();
  const { minMaxLiquidSwapAmounts, screenDimensions } = useAppStatus();
  const { signer, startRootstockEventListener } = useRootstockProvider();
  const { startLrc20EventListener } = useLRC20EventContext();
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
      : encodeLNURL(globalContactsInformation.myProfile.uniqueName),
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
          generatedAddress: encodeLNURL(
            globalContactsInformation.myProfile.uniqueName,
          ),
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
      } else if (
        selectedRecieveOption === 'Spark' &&
        masterInfoObject.lrc20Settings?.isEnabled
      ) {
        startLrc20EventListener(12);
      }
    }
    runAddressInit();
  }, [initialSendAmount, paymentDescription, selectedRecieveOption]);

  console.log(minMaxLiquidSwapAmounts);
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
          <TopBar navigate={navigate} />

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
  const errorOpacity = useSharedValue(0);
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
      errorOpacity.value = 0;
      loadingOpacity.value = 0;
      qrOpacity.value = withTiming(1, { duration: fadeInDuration });
    } else if (
      !newAddress &&
      !addressState.isGeneratingInvoice &&
      previousAddress.current
    ) {
      qrOpacity.value = withTiming(0, { duration: fadeOutDuration });
      loadingOpacity.value = 0;
      errorOpacity.value = withTiming(1, { duration: fadeInDuration });
      previousAddress.current = '';
    }
  }, [addressState.generatedAddress, addressState.isGeneratingInvoice]);

  const handleFadeOutComplete = newAddress => {
    if (newAddress) {
      previousAddress.current = newAddress;
      loadingOpacity.value = 0;
      errorOpacity.value = 0;
      qrOpacity.value = withTiming(1, { duration: fadeInDuration });
    } else if (addressState.isGeneratingInvoice) {
      previousAddress.current = '';
      errorOpacity.value = 0;
      loadingOpacity.value = withTiming(1, { duration: fadeInDuration });
    } else {
      previousAddress.current = '';
      loadingOpacity.value = 0;
      errorOpacity.value = withTiming(1, { duration: fadeInDuration });
    }
  };

  const handlePress = () => {
    if (
      selectedRecieveOption?.toLowerCase() === 'lightning' &&
      !initialSendAmount &&
      !isUsingAltAccount
    ) {
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'chooseLNURLCopyFormat',
      });
      return;
    }
    copyToClipboard(addressState.generatedAddress, showToast);
  };

  return (
    <View style={styles.qrCodeContainer}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[styles.qrCodeContainer, { backgroundColor: backgroundOffset }]}
      >
        <View
          style={{
            position: 'relative',
            alignItems: 'center',
            width: 300,
            height: 300,
          }}
        >
          <Animated.View
            style={{
              position: 'absolute',
              opacity: qrOpacity,
            }}
          >
            <QrCodeWrapper
              outerContainerStyle={{ backgroundColor: 'transparent' }}
              QRData={
                addressState.generatedAddress || previousAddress.current || ' '
              }
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
            <FullLoadingScreen
              text={t('screens.inAccount.receiveBtcPage.generatingInvoice')}
            />
          </Animated.View>

          <Animated.View
            style={{
              position: 'absolute',
              width: 300,
              height: 300,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 10,
              opacity: errorOpacity,
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
        </View>
      </TouchableOpacity>

      {!isUsingAltAccount && (
        <LNURLContainer
          theme={theme}
          textColor={textColor}
          selectedRecieveOption={selectedRecieveOption}
          initialSendAmount={initialSendAmount}
          globalContactsInformation={globalContactsInformation}
          navigate={navigate}
          masterInfoObject={masterInfoObject}
          fiatStats={fiatStats}
        />
      )}
    </View>
  );
}

function LNURLContainer({
  theme,
  textColor,
  selectedRecieveOption,
  initialSendAmount,
  globalContactsInformation,
  navigate,
  masterInfoObject,
  fiatStats,
}) {
  return (
    <TouchableOpacity
      activeOpacity={
        selectedRecieveOption.toLowerCase() === 'lightning' &&
        !initialSendAmount
          ? 0.2
          : 1
      }
      onPress={() => {
        if (
          !(
            selectedRecieveOption.toLowerCase() === 'lightning' &&
            !initialSendAmount
          )
        )
          return;
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'editLNURLOnReceive',
        });
      }}
      style={{
        width: '80%',
        paddingTop: 10,
        paddingBottom: 20,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
      }}
    >
      <ThemeText
        styles={{
          includeFontPadding: false,
          marginRight: 5,
          color: theme || initialSendAmount ? textColor : COLORS.primary,
        }}
        CustomNumberOfLines={1}
        content={
          selectedRecieveOption.toLowerCase() === 'lightning' &&
          !initialSendAmount
            ? `${globalContactsInformation?.myProfile?.uniqueName}@blitzwalletapp.com`
            : !initialSendAmount ||
              selectedRecieveOption.toLowerCase() === 'spark' ||
              selectedRecieveOption.toLowerCase() === 'rootstock'
            ? ' '
            : displayCorrectDenomination({
                amount: initialSendAmount,
                masterInfoObject,
                fiatStats,
              })
        }
      />
      {selectedRecieveOption.toLowerCase() === 'lightning' &&
        !initialSendAmount && (
          <ThemeImage
            styles={{ height: 20, width: 20 }}
            lightModeIcon={ICONS.editIcon}
            darkModeIcon={ICONS.editIconLight}
            lightsOutIcon={ICONS.editIconLight}
          />
        )}
    </TouchableOpacity>
  );
}

function TopBar(props) {
  return (
    <TouchableOpacity
      style={{ marginRight: 'auto' }}
      activeOpacity={0.6}
      onPress={props.navigate.goBack}
    >
      <ThemeImage
        darkModeIcon={ICONS.smallArrowLeft}
        lightModeIcon={ICONS.smallArrowLeft}
        lightsOutIcon={ICONS.arrow_small_left_white}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 10,
    marginTop: 'auto',
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
});
