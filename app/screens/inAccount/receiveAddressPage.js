import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { CENTER, ICONS, MAX_WEB_CONTENT_WIDTH } from '../../constants';
import GlobalThemeView from '../../functions/CustomElements/globalThemeView';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import Note from '../../functions/CustomElements/redesign/Note';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { initializeAddressProcess } from '../../functions/receiveBitcoin/addressGeneration';
import { shareMessage } from '../../functions/handleShare';
import { ACCUMULATION_CHAINS } from '../../constants/accumulationAddresses';
import { useAccumulationAddresses } from '../../hooks/useAccumulationAddresses';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useNodeContext } from '../../../context-store/nodeContext';
import { useWebView } from '../../../context-store/webViewContext';
import { useFlashnet } from '../../../context-store/flashnetContext';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../context-store/activeAccount';
import { useKeysContext } from '../../../context-store/keys';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import {
  ReceiveActions,
  ReceiveQrCard,
  shortAddress,
} from '../../components/admin/homeComponents/receiveBitcoin/receiveParts';

// No-amount address QR (Receive.dc.html "Bitcoin address", ReceiveMore.dc.html
// "USDT on Tron", "Tokens"). Params:
//   { selectedRecieveOption: 'Bitcoin' }                       Bitcoin address
//   { selectedRecieveOption: 'spark', fromTokens: true }       Spark tokens
//   { selectedRecieveOption: 'Stablecoins', sourceChain,
//     sourceAsset, destinationAsset }                          USDT/USDC, cbBTC
export default function ReceiveAddressPage(props) {
  const config = props.route.params;
  const option = config.selectedRecieveOption.toLowerCase();
  const isStable = option === 'stablecoins';
  const isBitcoin = option === 'bitcoin';

  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { bottomPadding } = useGlobalInsets();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { sendWebViewRequest } = useWebView();
  const { swapLimits, poolInfoRef } = useFlashnet();
  const { sparkInformation } = useSparkWallet();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { contactsPrivateKey, publicKey: contactsPublicKey } = useKeysContext();
  const { createAddress, addressesForOption } = useAccumulationAddresses();

  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const qrSize = Math.min(contentWidth - 60, 290);
  const chain = ACCUMULATION_CHAINS.find(c => c.id === config.sourceChain);

  const [addressState, setAddressState] = useState({
    generatedAddress: '',
    isGeneratingInvoice: true,
    errorMessageText: { type: null, text: '' },
  });

  // Same address rules as the old deposit QR view (depositQRView.js):
  // stablecoin routes mint a fresh accumulation address and fall back to a
  // saved one at the cap or on error (OQ-35); everything else goes through
  // initializeAddressProcess.
  useEffect(() => {
    let cancelled = false;
    const finish = (generatedAddress, errorText) => {
      if (cancelled) return;
      setAddressState({
        generatedAddress: generatedAddress || '',
        isGeneratingInvoice: false,
        errorMessageText: { type: errorText ? 'stop' : null, text: errorText },
      });
    };

    if (isStable) {
      const triple = {
        sourceChain: config.sourceChain,
        sourceAsset: config.sourceAsset,
        destinationAsset: config.destinationAsset,
      };
      createAddress({ ...triple, forceNew: true })
        .then(result => {
          const fresh =
            typeof result?.address === 'string'
              ? result.address
              : result?.address?.depositAddress;
          if (!result?.error && fresh) return finish(fresh);
          const saved = addressesForOption(triple)[0]?.depositAddress;
          if (saved) return finish(saved);
          finish(
            '',
            result?.error === 'limit_reached'
              ? 'screens.accumulationAddresses.create.limitReached'
              : 'screens.accumulationAddresses.errors.createFailed',
          );
        })
        .catch(() =>
          finish('', 'screens.accumulationAddresses.errors.createFailed'),
        );
      return () => {
        cancelled = true;
      };
    }

    initializeAddressProcess({
      userBalanceDenomination: masterInfoObject.userBalanceDenomination,
      receivingAmount: 0,
      description: undefined,
      masterInfoObject,
      setAddressState: updater => {
        if (!cancelled) setAddressState(updater);
      },
      selectedRecieveOption: config.selectedRecieveOption,
      navigate,
      signer: null,
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
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const usd = amount =>
    displayCorrectDenomination({
      amount: Number(amount).toFixed(2),
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: 'fiat',
      },
      fiatStats,
      forceCurrency: 'USD',
      convertAmount: false,
    });

  const info = (title, body) => () =>
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'receiveInfo',
      title,
      body,
    });

  const title = isBitcoin
    ? t('receive.bitcoinAddress')
    : isStable
    ? t('wallet.halfModal.stablecoinSelectedTitle', {
        curr: config.sourceAsset,
        chain: chain?.label,
      })
    : t('receive.receiveTokens');

  const rows = isBitcoin
    ? [
        {
          label: t('receive.networkFee'),
          value: t('receive.fromTheAmount'),
          onPress: info(t('receive.networkFee'), t('receive.networkFeeInfo')),
        },
        {
          label: t('receive.arrives'),
          value: t('receive.afterConfirmations'),
          onPress: info(t('receive.arrives'), t('receive.arrivesInfoBitcoin')),
        },
      ]
    : isStable
    ? [
        {
          label: t('receive.minimum'),
          value: usd(1),
          onPress: info(
            t('receive.minimum'),
            t('wallet.halfModal.depositMinimumStablecoin', { amount: usd(1) }),
          ),
        },
        {
          label: t('receive.fee'),
          value: t('receive.aboutOnePercent'),
          onPress: info(
            t('receive.fee'),
            t(
              config.destinationAsset === 'BTC'
                ? 'wallet.halfModal.depositFeePopup_accumulation_bitcoin'
                : 'wallet.halfModal.depositFeePopup_stablecoins',
            ),
          ),
        },
        {
          label: t('receive.arrives'),
          value: t('receive.inAFewMinutes'),
          onPress: info(
            t('receive.arrives'),
            t('receive.arrivesInfoStable', { chain: chain?.label }),
          ),
        },
      ]
    : [];

  const warning = isBitcoin
    ? t('receive.bitcoinWarning', { amount: usd(50) })
    : isStable
    ? t('receive.stableWarning', {
        asset: config.sourceAsset,
        chain: chain?.label,
      })
    : t('receive.tokensWarning');

  const address = addressState.generatedAddress;

  return (
    <GlobalThemeView useStandardWidth={false} styles={styles.screen}>
      <View
        style={[
          styles.container,
          { width: contentWidth, paddingBottom: bottomPadding },
        ]}
      >
        <TopBar title={title} />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <ReceiveQrCard
            value={address}
            size={qrSize}
            loading={addressState.isGeneratingInvoice}
            errorText={
              addressState.errorMessageText?.text
                ? t(addressState.errorMessageText.text)
                : ''
            }
            caption={shortAddress(address)}
            rows={rows}
          />
        </CustomScrollView>
        <View style={styles.warning}>
          <Note tone="warn" text={warning} />
        </View>
        <ReceiveActions
          value={address}
          onShare={() => shareMessage({ message: address })}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  container: { flex: 1, ...CENTER },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  warning: { marginBottom: 16 },
});
