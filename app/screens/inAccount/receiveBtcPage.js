import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import {
  CENTER,
  SIZES,
  COLORS,
  ICONS,
  CONTENT_KEYBOARD_OFFSET,
} from '../../constants';
import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { copyToClipboard } from '../../functions';
import { useGlobalContextProvider } from '../../../context-store/context';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import GetThemeColors from '../../hooks/themeColors';
import { initializeAddressProcess } from '../../functions/receiveBitcoin/addressGeneration';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import QrCodeWrapper from '../../functions/CustomElements/QrWrapper';
import { useNodeContext } from '../../../context-store/nodeContext';
import { useAppStatus } from '../../../context-store/appStatus';
import { crashlyticsLogReport } from '../../functions/crashlyticsLogs';
import { useGlobalContactsInfo } from '../../../context-store/globalContacts';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { useToast } from '../../../context-store/toastManager';
import { useActiveCustodyAccount } from '../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import { useWebView } from '../../../context-store/webViewContext';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useFlashnet } from '../../../context-store/flashnetContext';
import { dollarsToSats, satsToDollars } from '../../functions/spark/flashnet';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useKeysContext } from '../../../context-store/keys';
import { useAccumulationAddresses } from '../../hooks/useAccumulationAddresses';
import { useRootstockProvider } from '../../../context-store/rootstockSwapContext';
import customUUID from '../../functions/customUUID';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../../constants/theme';
import { shareMessage } from '../../functions/handleShare';
import ThemeImage from '../../functions/CustomElements/themeImage';
import { useGlobalThemeContext } from '../../../context-store/theme';
import usePaymentInputDisplay from '../../hooks/usePaymentInputDisplay';

export default function ReceivePaymentHome(props) {
  const navigate = useNavigation();
  const { fiatStats } = useNodeContext();
  const { sendWebViewRequest } = useWebView();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { swapLimits, poolInfoRef, swapUSDPriceDollars } = useFlashnet();
  const { sparkInformation, toggleNewestPaymentTimestamp } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { screenDimensions } = useAppStatus();
  const { signer } = useRootstockProvider();
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const { isUsingAltAccount, currentWalletMnemoinc } =
    useActiveCustodyAccount();
  const { contactsPrivateKey, publicKey: contactsPublicKey } = useKeysContext();
  const { createAddress } = useAccumulationAddresses();
  const { bottomPadding } = useGlobalInsets();
  const qrContainerSize = Math.round(screenDimensions.width * 0.8);
  const qrInnerSize = qrContainerSize - 25;

  const routeParams = props.route?.params || {};
  const paymentDescription = routeParams.description;
  const requestUUID = routeParams.uuid;
  const endReceiveType =
    routeParams.endReceiveType || routeParams.initialReceiveType || 'BTC';

  const userReceiveAmount = routeParams.receiveAmount || 0;
  const [initialSendAmount, setInitialSendAmount] = useState(userReceiveAmount);

  const prevRequstInfo = useRef(null);
  const addressStateRef = useRef(null);
  const generationRef = useRef(0);
  const toggleDebounceRef = useRef(null);

  const [sharePayLinkCache, setSharePayLinkCache] = useState(null);

  const [addressState, setAddressState] = useState({
    isReceivingSwap: false,
    generatedAddress: '',
    isGeneratingInvoice: true,
    errorMessageText: {
      type: null,
      text: '',
    },
    fee: 0,
  });

  useEffect(() => {
    return () => {
      if (toggleDebounceRef.current) clearTimeout(toggleDebounceRef.current);
    };
  }, []);

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
        paymentDescription === prevRequstInfo.current.paymentDescription &&
        !addressStateRef.current.errorMessageText.text &&
        endReceiveType === prevRequstInfo.current.endReceiveType
      ) {
        return;
      }

      prevRequstInfo.current = {
        userReceiveAmount,
        paymentDescription,
        endReceiveType,
      };

      // if (
      //   !userReceiveAmount &&
      //   !isUsingAltAccount &&
      //   endReceiveType === 'BTC' &&
      //   !paymentDescription &&
      //   masterInfoObject.lnurlReceiveCurrency !== 'usd'
      // ) {
      //   setInitialSendAmount(0);
      //   setAddressState(prev => ({
      //     ...prev,
      //     generatedAddress: `${globalContactsInformation.myProfile.uniqueName}@blitzwalletapp.com`,
      //   }));
      //   return;
      // }

      generationRef.current += 1;
      const gen = generationRef.current;
      const guardedSetAddressState = updater => {
        if (generationRef.current === gen) setAddressState(updater);
      };

      await initializeAddressProcess({
        userBalanceDenomination: masterInfoObject.userBalanceDenomination,
        receivingAmount: userReceiveAmount,
        description: paymentDescription,
        masterInfoObject,
        setAddressState: guardedSetAddressState,
        selectedRecieveOption: 'Lightning',
        navigate,
        signer,
        currentWalletMnemoinc,
        sendWebViewRequest,
        sparkInformation,
        endReceiveType,
        swapLimits,
        setInitialSendAmount,
        userReceiveAmount,
        poolInfoRef,
        isHoldInvoice: false,
        holdExpirySeconds: 2592000,
        contactsPrivateKey,
        contactsPublicKey,
        createAddress,
        sourceChain: undefined,
        sourceAsset: undefined,
        destinationAsset: undefined,
      });
    }
    runAddressInit();
  }, [userReceiveAmount, paymentDescription, requestUUID, endReceiveType]);

  const minUsdSats = Math.round(
    Math.max(
      swapLimits.bitcoin || 0,
      dollarsToSats(1, poolInfoRef?.currentPriceAInB),
    ),
  );

  const toggleReceiveAsset = target => {
    if (target === endReceiveType) return;
    if (toggleDebounceRef.current) clearTimeout(toggleDebounceRef.current);
    toggleDebounceRef.current = setTimeout(() => {
      let amount = Math.round(initialSendAmount || userReceiveAmount || 0);
      if (target === 'USD' && amount < minUsdSats) amount = minUsdSats;
      navigate.setParams({
        endReceiveType: target,
        receiveAmount: amount,
        uuid: customUUID(),
      });
    }, 300);
  };

  const { showToast } = useToast();
  const address = addressState.generatedAddress || '';

  const isUsingLnurl = false;
  // !initialSendAmount &&
  // !isUsingAltAccount &&
  // endReceiveType === 'BTC' &&
  // !paymentDescription &&
  // masterInfoObject.lnurlReceiveCurrency !== 'usd';

  const displayAddress = isUsingLnurl
    ? `${globalContactsInformation?.myProfile?.uniqueName}@blitzwalletapp.com`
    : address;

  const displayedReceiveAmount = initialSendAmount || userReceiveAmount || 0;
  const amountCardValue = displayedReceiveAmount;
  const actionTextColor =
    theme && darkModeType ? COLORS.lightModeText : COLORS.darkModeText;
  const primaryButtonBackground =
    theme && darkModeType ? COLORS.darkModeText : COLORS.primary;

  const handleShareInvoice = () => {
    const amount = displayedReceiveAmount;
    const currencyType = endReceiveType;

    if (!amount) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.halfModal.paylinkAmountRequired'),
      });
      return;
    }

    navigate.navigate('CustomHalfModal', {
      wantedContent: 'shareInvoicePaylink',
      rawAmount: amount,
      currencyType,
      sharePayLinkCache,
      onCreated: payLinkId => {
        setSharePayLinkCache({ payLinkId, amount, currencyType });
      },
    });
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('constants.receive')}
        showLeftImage={true}
        iconNew={'SquarePen'}
        leftImageStyles={{ width: 25, height: 25 }}
        leftImageFunction={() => {
          navigate.navigate('EditReceivePaymentInformation', {
            from: 'receivePage',
            receiveType: 'Lightning',
            endReceiveType,
            userReceiveAmount: displayedReceiveAmount,
            description: paymentDescription,
          });
        }}
      />
      <View
        style={{ flex: 1, ...CENTER, width: INSET_WINDOW_WIDTH, height: 500 }}
      >
        <View style={styles.toggleContainer}>
          <BtcUsdToggle
            endReceiveType={endReceiveType}
            onToggle={toggleReceiveAsset}
            theme={theme}
            darkModeType={darkModeType}
          />
        </View>

        <ScrollView
          style={{ width: '100%' }}
          contentContainerStyle={{
            justifyContent: 'center',
            alignItems: 'center',
            flexGrow: 1,
            paddingBottom: bottomPadding,
          }}
          showsVerticalScrollIndicator={false}
        >
          <AmountDisplay
            displayedReceiveAmount={displayedReceiveAmount}
            amountCardValue={amountCardValue}
            endReceiveType={endReceiveType}
            masterInfoObject={masterInfoObject}
            fiatStats={fiatStats}
            swapUSDPriceDollars={swapUSDPriceDollars}
          />
          <TouchableOpacity
            onPress={() => {
              if (displayAddress) copyToClipboard(displayAddress, showToast);
            }}
            style={styles.invoiceRow}
          >
            <QrCode
              globalContactsInformation={globalContactsInformation}
              addressState={addressState}
              qrContainerSize={qrContainerSize}
              qrInnerSize={qrInnerSize}
              isUsingLnurl={isUsingLnurl}
            />
          </TouchableOpacity>

          <NotePill description={paymentDescription} t={t} />
        </ScrollView>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.actionButton,
            {
              backgroundColor: primaryButtonBackground,
              marginTop: CONTENT_KEYBOARD_OFFSET,
            },
          ]}
          onPress={() => {
            if (displayAddress) copyToClipboard(displayAddress, showToast);
          }}
        >
          <ThemeIcon
            iconName={'Copy'}
            size={18}
            colorOverride={actionTextColor}
          />
          <ThemeText
            CustomNumberOfLines={1}
            content={t('screens.inAccount.receiveBtcPage.copyInvoice')}
            styles={[styles.actionButtonText, { color: actionTextColor }]}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.actionButton,
            styles.ctaSecondary,
            { borderColor: backgroundOffset, marginTop: 10 },
          ]}
          onPress={handleShareInvoice}
        >
          <ThemeIcon iconName={'Share'} size={18} />
          <ThemeText
            CustomNumberOfLines={1}
            content={t('screens.inAccount.receiveBtcPage.shareInvoice')}
            styles={styles.actionButtonText}
          />
        </TouchableOpacity>
      </View>
    </GlobalThemeView>
  );
}

function BtcUsdToggle({ endReceiveType, onToggle, theme, darkModeType }) {
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
  const { t } = useTranslation();
  const [pillWidth, setPillWidth] = useState(0);

  const thumbX = useSharedValue(0);

  useEffect(() => {
    thumbX.value = withTiming(
      endReceiveType === 'USD' ? (pillWidth - 10) / 2 : 0,
      { duration: 350 },
    );
  }, [endReceiveType, pillWidth]);

  const thumbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  const options = [
    { key: 'BTC', symbol: 'bitcoinIcon', label: t('constants.bitcoin_upper') },
    { key: 'USD', symbol: 'dollarIcon', label: t('constants.dollars_upper') },
  ];

  return (
    <View
      style={[styles.togglePill, { backgroundColor: backgroundOffset }]}
      onLayout={e => setPillWidth(e.nativeEvent.layout.width)}
    >
      {pillWidth > 0 && (
        <Animated.View
          style={[
            styles.toggleThumb,
            { width: pillWidth / 2 - 4, backgroundColor },
            thumbAnimStyle,
          ]}
        />
      )}
      {options.map(option => {
        const active = endReceiveType === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            activeOpacity={0.8}
            onPress={() => onToggle(option.key)}
            style={styles.toggleOption}
          >
            <ThemeImage
              styles={{
                width: SIZES.medium,
                height: SIZES.medium,
                tintColor: textColor,
                opacity: active ? 1 : 0.4,
              }}
              lightModeIcon={ICONS?.[option.symbol]}
              darkModeIcon={ICONS?.[option.symbol]}
              lightsOutIcon={ICONS?.[option.symbol]}
            />
            <ThemeText
              styles={[
                styles.toggleOptionText,
                {
                  opacity: active ? 1 : 0.4,
                  fontWeight: active ? '500' : '400',
                },
              ]}
              content={option.label}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AmountDisplay({
  displayedReceiveAmount,
  amountCardValue,
  endReceiveType,
  masterInfoObject,
  fiatStats,
  swapUSDPriceDollars,
}) {
  const inputDenomination = endReceiveType === 'USD' ? 'fiat' : 'sats';
  const { primaryDisplay, secondaryDisplay, conversionFiatStats } =
    usePaymentInputDisplay({
      paymentMode: endReceiveType,
      inputDenomination,
      fiatStats,
      usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
      masterInfoObject,
    });

  if (!amountCardValue) return null;

  const primaryFiatStats = primaryDisplay.forceFiatStats || conversionFiatStats;
  const secondaryFiatStats =
    secondaryDisplay.forceFiatStats ||
    (secondaryDisplay.forceCurrency === 'USD'
      ? { coin: 'USD', value: swapUSDPriceDollars }
      : fiatStats);

  return (
    <View style={styles.amountContainer}>
      <ThemeText
        styles={[
          styles.amountPrimary,
          !displayedReceiveAmount && { opacity: 0.4 },
        ]}
        content={displayCorrectDenomination({
          amount: amountCardValue,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: primaryDisplay.denomination,
          },
          fiatStats: primaryFiatStats,
          forceCurrency: primaryDisplay.forceCurrency,
        })}
        adjustsFontSizeToFit
        CustomNumberOfLines={1}
      />
      <ThemeText
        styles={styles.amountSecondary}
        content={displayCorrectDenomination({
          amount: amountCardValue,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: secondaryDisplay.denomination,
          },
          fiatStats: secondaryFiatStats,
          forceCurrency: secondaryDisplay.forceCurrency,
        })}
      />
    </View>
  );
}

function NotePill({ description, t }) {
  const { backgroundOffset } = GetThemeColors();
  return (
    <View style={[styles.notePill, { backgroundColor: backgroundOffset }]}>
      <ThemeText
        styles={[styles.notePillText, !description && { opacity: 0.5 }]}
        content={description || t('constants.noDescription')}
        CustomNumberOfLines={1}
      />
    </View>
  );
}

function QrCode({
  addressState,
  globalContactsInformation,
  qrContainerSize,
  qrInnerSize,
  isUsingLnurl,
}) {
  const { backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();

  const qrOpacity = useSharedValue(addressState.generatedAddress ? 1 : 0);
  const loadingOpacity = useSharedValue(isUsingLnurl ? 0 : 1);
  const previousAddress = useRef(addressState.generatedAddress);
  const fadeOutDuration = 200;
  const fadeInDuration = 200;

  useEffect(() => {
    const newAddress = addressState.generatedAddress;
    const hasChanged = newAddress !== previousAddress.current;

    if (
      addressState.errorMessageText?.text &&
      addressState.errorMessageText?.type !== 'warning'
    ) {
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
            scheduleOnRN(handleFadeOutComplete, newAddress);
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
      loadingOpacity.value = 0;
      qrOpacity.value = withTiming(1, { duration: fadeInDuration });
    }
  }, [
    addressState.generatedAddress,
    addressState.isGeneratingInvoice,
    addressState.errorMessageText,
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

  const qrData =
    (isUsingLnurl
      ? `${globalContactsInformation?.myProfile?.uniqueName}@blitzwalletapp.com`
      : addressState.generatedAddress) ||
    previousAddress.current ||
    ' ';

  return (
    <View
      style={[
        styles.qrCodeContainer,
        {
          backgroundColor: backgroundOffset,
          width: qrContainerSize,
          minHeight: qrContainerSize,
        },
      ]}
    >
      <View
        style={[
          styles.animatedQRContainer,
          { width: qrContainerSize, height: qrContainerSize },
        ]}
      >
        {!addressState.errorMessageText?.text ||
        addressState.errorMessageText?.type === 'warning' ? (
          <>
            <Animated.View
              style={{
                position: 'absolute',
                opacity: qrOpacity,
              }}
            >
              <QrCodeWrapper
                outerContainerStyle={{
                  backgroundColor: 'transparent',
                  width: qrContainerSize,
                  height: qrContainerSize,
                  borderRadius: 10,
                }}
                innerContainerStyle={{
                  width: qrContainerSize,
                  height: qrContainerSize,
                  borderRadius: 10,
                }}
                quietZone={15}
                qrSize={qrContainerSize}
                QRData={qrData}
              />
            </Animated.View>

            <Animated.View
              style={{
                position: 'absolute',
                width: qrContainerSize,
                height: qrContainerSize,
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
              width: qrContainerSize,
              height: qrContainerSize,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 10,
              zIndex: 99,
              backgroundColor: backgroundOffset,
            }}
          >
            <ThemeText
              styles={styles.errorText}
              content={t(addressState.errorMessageText.text)}
            />
          </View>
        )}
      </View>
      {addressState.errorMessageText?.text &&
        addressState.errorMessageText?.type === 'warning' && (
          <ThemeText
            styles={[
              styles.errorText,
              { marginTop: 10, marginBottom: 20, fontSize: SIZES.smedium },
            ]}
            content={t(addressState.errorMessageText.text)}
          />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggleContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: CONTENT_KEYBOARD_OFFSET,
    width: '100%',
    ...CENTER,
  },
  togglePill: {
    width: '100%',
    height: 50,
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    position: 'relative',
  },
  toggleThumb: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    gap: 5,
  },
  toggleSymbol: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  toggleOptionText: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  animatedQRContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  qrShadowCard: {
    borderRadius: 24,
    backgroundColor: 'white',
    padding: 12,
    marginTop: 10,
  },
  qrCodeContainer: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  errorText: {
    width: '90%',
    fontSize: SIZES.medium,
    textAlign: 'center',
    marginTop: 20,
    includeFontPadding: false,
  },
  invoiceRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButton: {
    minWidth: 120,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.darkModeText,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    includeFontPadding: false,
    textAlign: 'center',
    flexShrink: 1,
  },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    width: '100%',
    marginTop: 8,
  },
  ctaPrimaryText: {
    fontSize: SIZES.medium,
    fontWeight: '600',
    color: 'white',
    includeFontPadding: false,
  },
  ctaSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    width: '100%',
    marginTop: 12,
  },
  ctaSecondaryText: {
    fontSize: SIZES.medium,
    fontWeight: '600',
    includeFontPadding: false,
  },
  amountContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 34,
    width: '100%',
  },
  amountPrimary: {
    fontSize: SIZES.huge,
    includeFontPadding: false,
    textAlign: 'center',
  },
  amountSecondary: {
    fontSize: SIZES.smedium,
    opacity: 0.5,
    includeFontPadding: false,

    textAlign: 'center',
  },
  notePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 16,
    maxWidth: '80%',
  },
  notePillText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
});
