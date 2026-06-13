import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  FONT,
  SIZES,
} from '../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import QrCodeWrapper from '../../../../functions/CustomElements/QrWrapper';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { copyToClipboard } from '../../../../functions';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';

import { initializeAddressProcess } from '../../../../functions/receiveBitcoin/addressGeneration';
import { useAccumulationAddresses } from '../../../../hooks/useAccumulationAddresses';
import { ACCUMULATION_CHAINS } from '../../../../constants/accumulationAddresses';

import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useWebView } from '../../../../../context-store/webViewContext';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { useKeysContext } from '../../../../../context-store/keys';
import { useRootstockProvider } from '../../../../../context-store/rootstockSwapContext';
import { useLiquidEvent } from '../../../../../context-store/liquidEventContext';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useToast } from '../../../../../context-store/toastManager';
import { applyErrorAnimationTheme } from '../../../../functions/lottieViewColorTransformer';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import LottieView from 'lottie-react-native';
const errorTxAnimation = require('../../../../assets/errorTxAnimation.json');

const capitalize = value =>
  value ? value[0].toUpperCase() + value.slice(1) : '';

export default function DepositQRView({
  config,
  setContentHeight,
  onBack,
  isActive,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { fiatStats } = useNodeContext();
  const { sendWebViewRequest } = useWebView();
  const { swapLimits, poolInfoRef } = useFlashnet();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { startRootstockEventListener, signer } = useRootstockProvider();
  const { startLiquidEventListener } = useLiquidEvent();
  const { isUsingAltAccount, currentWalletMnemoinc } =
    useActiveCustodyAccount();
  const { contactsPrivateKey, publicKey: contactsPublicKey } = useKeysContext();
  const { createAddress } = useAccumulationAddresses();
  const { minMaxLiquidSwapAmounts, screenDimensions } = useAppStatus();
  const { bottomPadding } = useGlobalInsets();

  const qrContainerSize = Math.round(screenDimensions.width * 0.7);
  const errorIconSize = Math.round(screenDimensions.width * 0.5);
  const qrInnerSize = qrContainerSize - 25;

  const [addressState, setAddressState] = useState({
    generatedAddress: '',
    isGeneratingInvoice: false,
    errorMessageText: { type: '', text: '' },
    fee: 0,
  });

  const option = config?.selectedRecieveOption?.toLowerCase();

  const chainDisplayLabel =
    ACCUMULATION_CHAINS.find(c => c.id === config?.sourceChain)?.label ??
    capitalize(config?.sourceChain);

  const errorAnimation = useMemo(() => {
    return applyErrorAnimationTheme(
      errorTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  useEffect(() => {
    if (isActive) setContentHeight(700);
  }, [isActive]);

  useEffect(() => {
    if (!config) return;

    let cancelled = false;

    setAddressState({
      generatedAddress: '',
      isGeneratingInvoice: true,
      errorMessageText: { type: null, text: '' },
      fee: 0,
    });

    async function runAddressInit() {
      await initializeAddressProcess({
        userBalanceDenomination: masterInfoObject.userBalanceDenomination,
        receivingAmount: 0,
        description: undefined,
        masterInfoObject,
        setAddressState,
        selectedRecieveOption: config.selectedRecieveOption,
        navigate,
        signer,
        currentWalletMnemoinc,
        sendWebViewRequest,
        sparkInformation,
        endReceiveType: 'BTC',
        swapLimits,
        setInitialSendAmount: () => {},
        userReceiveAmount: 0,
        poolInfoRef,
        isHoldInvoice: false,
        holdExpirySeconds: 2592000,
        contactsPrivateKey,
        contactsPublicKey,
        createAddress,
        sourceChain: config.sourceChain,
        sourceAsset: config.sourceAsset,
        destinationAsset: config.destinationAsset,
      });

      if (cancelled) return;
      const option = config.selectedRecieveOption?.toLowerCase();
      if (option === 'liquid') {
        startLiquidEventListener(60);
      } else if (option === 'rootstock') {
        startRootstockEventListener({ durationMs: 1200000 });
      }
    }

    runAddressInit();
    return () => {
      cancelled = true;
    };
  }, [config]);

  const minimumDepositWarning = useMemo(() => {
    if (option === 'stablecoins') {
      return t('wallet.halfModal.depositMinimumStablecoin', {
        amount: displayCorrectDenomination({
          amount: Number(1).toFixed(2),
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'fiat',
          },
          fiatStats,
          forceCurrency: 'USD',
          convertAmount: false,
        }),
      });
    }
    if (option !== 'liquid' && option !== 'rootstock') return null;

    const minSendAmount =
      option === 'rootstock'
        ? minMaxLiquidSwapAmounts?.rsk?.min + 1000
        : minMaxLiquidSwapAmounts?.min;

    if (!Number.isFinite(minSendAmount)) return null;

    const swapType = option === 'rootstock' ? 'Rootstock' : 'Liquid';

    return t('wallet.receivePages.switchReceiveOptionPage.swapWarning', {
      amount: displayCorrectDenomination({
        amount: minSendAmount,
        masterInfoObject,
        fiatStats,
      }),
      swapType,
    });
  }, [fiatStats, masterInfoObject, minMaxLiquidSwapAmounts, option, t]);

  const address = addressState.generatedAddress || '';
  const addressSegments = useMemo(() => {
    return (address.match(/.{1,4}/g) || []).map((group, i, all) => (
      <Text
        key={i}
        style={{
          fontFamily: i % 2 === 0 ? FONT.Title_SemiBold : FONT.Title_Regular,
        }}
      >
        {group}
        {i < all.length - 1 ? ' ' : ''}
      </Text>
    ));
  }, [address]);

  if (!config) return null;

  const title =
    option === 'stablecoins'
      ? chainDisplayLabel
      : capitalize(config.selectedRecieveOption);

  const instruction =
    option === 'stablecoins'
      ? t('wallet.halfModal.depositQRInstruction_stablecoins', {
          asset: config.sourceAsset,
          chain: chainDisplayLabel,
        })
      : t(
          `wallet.halfModal.depositQRInstruction_${option}${
            option === 'spark' && config.fromStablecoin ? '_dollars' : ''
          }`,
        );

  const handleCopy = () => {
    if (!address) return;
    copyToClipboard(address, showToast);
  };

  if (addressState.isGeneratingInvoice) {
    return (
      <View style={styles.centerContent}>
        <FullLoadingScreen showText={false} />
      </View>
    );
  }

  if (addressState.errorMessageText?.text) {
    return (
      <View style={styles.centerContent}>
        <LottieView
          source={errorAnimation}
          loop={false}
          autoPlay={true}
          style={{
            width: errorIconSize,
            height: errorIconSize,
          }}
        />
        <ThemeText
          styles={styles.errorText}
          content={t('wallet.halfModal.depositQRError', { addressType: title })}
        />
        <CustomButton
          buttonStyles={{
            width: '100%',
            marginBottom: bottomPadding,
            ...CENTER,
            marginTop: 'auto',
          }}
          actionFunction={onBack}
          textContent={t('constants.back')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.qrWrapper}
          activeOpacity={0.8}
          onPress={handleCopy}
        >
          <QrCodeWrapper
            QRData={address}
            qrSize={qrInnerSize}
            outerContainerStyle={{
              width: qrContainerSize,
              height: qrContainerSize,
            }}
            innerContainerStyle={{
              width: qrInnerSize,
              height: qrInnerSize,
            }}
          />
        </TouchableOpacity>

        <ThemeText
          adjustsFontSizeToFit={true}
          styles={styles.addressText}
          content={addressSegments}
        />

        <View
          style={[
            styles.divider,
            {
              backgroundColor:
                theme && darkModeType ? backgroundColor : backgroundOffset,
            },
          ]}
        />

        <ThemeText styles={styles.instruction} content={instruction} />
      </ScrollView>
      {minimumDepositWarning ? (
        <ThemeText
          styles={styles.warningDescription}
          content={minimumDepositWarning}
        />
      ) : null}
      <CustomButton
        buttonStyles={{
          width: '100%',
          marginBottom: bottomPadding,
          ...CENTER,
          marginTop: CONTENT_KEYBOARD_OFFSET,
        }}
        actionFunction={handleCopy}
        textContent={t('wallet.halfModal.copyAddress')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    // marginBottom: 12,
  },
  backChevron: {
    position: 'absolute',
    left: 0,
    height: 40,
    justifyContent: 'center',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    width: '100%',
    flexGrow: 1,
    alignItems: 'stretch',
  },
  qrWrapper: {
    alignSelf: 'center',
  },
  addressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
  },
  addressLabel: {
    fontSize: SIZES.small,
    opacity: 0.6,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  addressText: {
    fontSize: SIZES.small,
    lineHeight: 24,
    marginTop: 10,
    includeFontPadding: false,
    textAlign: 'center',
    width: '100%',
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 16,
  },
  instruction: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    includeFontPadding: false,
  },
  warningDescription: {
    includeFontPadding: false,
    fontSize: SIZES.small,
    textAlign: 'center',
    opacity: HIDDEN_OPACITY,
    marginTop: 16,
  },
  errorText: {
    width: '90%',
    fontSize: SIZES.medium,
    textAlign: 'center',
    marginTop: 12,
    includeFontPadding: false,
  },
  errorSubText: {
    width: '90%',
    fontSize: SIZES.smedium,
    opacity: 0.5,
    textAlign: 'center',
    marginTop: 8,
    includeFontPadding: false,
  },
});
