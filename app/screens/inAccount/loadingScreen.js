import {AppState, Platform, StyleSheet, TouchableOpacity} from 'react-native';
import {COLORS, FONT, ICONS} from '../../constants';
import {useGlobalContextProvider} from '../../../context-store/context';
import {useEffect, useRef, useState} from 'react';
import {
  connectLsp,
  listLsps,
  nodeInfo,
  parseInput,
  serviceHealthCheck,
} from '@breeztech/react-native-breez-sdk';
import {breezPaymentWrapper, getTransactions} from '../../functions/SDK';
import {useTranslation} from 'react-i18next';
import autoChannelRebalance from '../../functions/liquidWallet/autoChannelRebalance';
import initializeUserSettingsFromHistory from '../../functions/initializeUserSettings';
import claimUnclaimedBoltzSwaps from '../../functions/boltz/claimUnclaimedTxs';
import {useGlobalContacts} from '../../../context-store/globalContacts';
import {
  getDateXDaysAgo,
  isMoreThan7DaysPast,
} from '../../functions/rotateAddressDateChecker';
import {useGlobaleCash} from '../../../context-store/eCash';
import {useGlobalAppData} from '../../../context-store/appData';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import LottieView from 'lottie-react-native';
import {useNavigation} from '@react-navigation/native';
import ThemeImage from '../../functions/CustomElements/themeImage';
import {
  fetchFiatRates,
  getInfo,
  listFiatCurrencies,
  listPayments,
} from '@breeztech/react-native-breez-sdk-liquid';
import connectToLightningNode from '../../functions/connectToLightning';
import connectToLiquidNode from '../../functions/connectToLiquid';
import {
  breezLiquidPaymentWrapper,
  breezLiquidReceivePaymentWrapper,
} from '../../functions/breezLiquid';
import {initializeDatabase} from '../../functions/messaging/cachedMessages';
import {useLiquidEvent} from '../../../context-store/liquidEventContext';
import {useLightningEvent} from '../../../context-store/lightningEventContext';
import {useGlobalThemeContext} from '../../../context-store/theme';
import {useNodeContext} from '../../../context-store/nodeContext';
import {useAppStatus} from '../../../context-store/appStatus';
import {useKeysContext} from '../../../context-store/keys';
import {
  getAllMints,
  getSelectedMint,
  getStoredEcashTransactions,
  getStoredProofs,
  initEcashDBTables,
} from '../../functions/eCash/db';
import {
  getMeltQuote,
  initEcashWallet,
  payLnInvoiceFromEcash,
} from '../../functions/eCash/wallet';
import {sumProofsValue} from '../../functions/eCash/proofs';
import {initializePOSTransactionsDatabase} from '../../functions/pos';
export default function ConnectingToNodeLoadingScreen({
  navigation: {replace},
  route,
}) {
  const navigate = useNavigation();
  const {onLightningBreezEvent} = useLightningEvent();
  const {onLiquidBreezEvent} = useLiquidEvent();
  const {toggleMasterInfoObject, masterInfoObject, setMasterInfoObject} =
    useGlobalContextProvider();
  const {toggleContactsPrivateKey} = useKeysContext();
  const {minMaxLiquidSwapAmounts, toggleMinMaxLiquidSwapAmounts} =
    useAppStatus();
  const {toggleNodeInformation, toggleLiquidNodeInformation} = useNodeContext();
  const {theme} = useGlobalThemeContext();
  const {toggleGlobalContactsInformation, globalContactsInformation} =
    useGlobalContacts();
  const {
    toggleGLobalEcashInformation,
    toggleEcashWalletInformation,
    toggleMintList,
  } = useGlobaleCash();
  const {toggleGlobalAppDataInformation} = useGlobalAppData();

  const [hasError, setHasError] = useState(null);
  const {t} = useTranslation();

  //gets data from either firebase or local storage to load users saved settings
  const didLoadInformation = useRef(false);
  const didOpenDatabases = useRef(false);
  const didRestoreWallet = route?.params?.didRestoreWallet;
  const isInialredner = useRef(true);

  const [message, setMessage] = useState(t('loadingScreen.message1'));

  useEffect(() => {
    const intervalId = setInterval(() => {
      setMessage(prevMessage =>
        prevMessage === t('loadingScreen.message1')
          ? t('loadingScreen.message2')
          : t('loadingScreen.message1'),
      );
    }, 5000);

    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    async function startConnectProcess() {
      try {
        const [
          didOpen,
          ecashTablesOpened,
          posTransactions,
          didLoadUserSettings,
        ] = await Promise.all([
          initializeDatabase(),
          initEcashDBTables(),
          initializePOSTransactionsDatabase(),
          initializeUserSettingsFromHistory({
            setContactsPrivateKey: toggleContactsPrivateKey,
            setMasterInfoObject,
            toggleGlobalContactsInformation,
            toggleGLobalEcashInformation,
            toggleGlobalAppDataInformation,
          }),
        ]);
        if (!didOpen || !ecashTablesOpened || !posTransactions)
          throw new Error('Database initialization failed');

        if (!didLoadUserSettings)
          throw new Error('Failed to load user settings');

        claimUnclaimedBoltzSwaps();
        didOpenDatabases.current = true;
      } catch (err) {
        console.log('intializatiion error', err);
        setHasError(err.message);
      }
    }
    startConnectProcess();
  }, []);

  useEffect(() => {
    if (
      Object.keys(masterInfoObject).length === 0 ||
      didLoadInformation.current ||
      Object.keys(globalContactsInformation).length === 0 ||
      !didOpenDatabases.current
    )
      return;
    didLoadInformation.current = true;

    initWallet();
  }, [masterInfoObject, globalContactsInformation]);

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
      {hasError && (
        <TouchableOpacity
          onPress={() => navigate.navigate('SettingsHome', {isDoomsday: true})}
          style={styles.doomsday}>
          <ThemeImage
            lightModeIcon={ICONS.settingsIcon}
            darkModeIcon={ICONS.settingsIcon}
            lightsOutIcon={ICONS.settingsWhite}
          />
        </TouchableOpacity>
      )}
      <LottieView
        source={
          theme
            ? require('../../assets/MOSCATWALKING2White.json')
            : require('../../assets/MOSCATWALKING2Blue.json')
        }
        autoPlay
        loop={true}
        style={{
          width: 150, // adjust as necessary
          height: 150, // adjust as necessary
        }}
      />

      <ThemeText
        styles={{
          ...styles.waitingText,
          color: theme ? COLORS.darkModeText : COLORS.primary,
        }}
        content={hasError ? hasError : message}
      />
    </GlobalThemeView>
  );

  async function initWallet() {
    console.log('HOME RENDER BREEZ EVENT FIRST LOAD');
    // initBalanceAndTransactions(toggleNodeInformation);

    try {
      const [didConnectToNode, didConnectToLiquidNode] = await (masterInfoObject
        .liquidWalletSettings.isLightningEnabled
        ? Promise.all([
            connectToLightningNode(onLightningBreezEvent),
            connectToLiquidNode(onLiquidBreezEvent),
          ])
        : Promise.all([
            Promise.resolve({isConnected: true}),
            connectToLiquidNode(onLiquidBreezEvent),
          ]));

      if (
        (didConnectToNode?.isConnected ||
          !masterInfoObject.liquidWalletSettings.isLightningEnabled) &&
        didConnectToLiquidNode?.isConnected
      ) {
        const [didSetLightning, didSetLiquid, didSetEcashInformation] =
          await (masterInfoObject.liquidWalletSettings.isLightningEnabled
            ? Promise.all([
                setNodeInformationForSession(didConnectToNode?.node_info),
                setLiquidNodeInformationForSession(
                  didConnectToLiquidNode?.liquid_node_info,
                ),
                setEcashInformationForSession(),
              ])
            : Promise.all([
                Promise.resolve({}),
                setLiquidNodeInformationForSession(
                  didConnectToLiquidNode?.liquid_node_info,
                ),
                setEcashInformationForSession(),
              ]));

        if (
          (didSetLightning ||
            !masterInfoObject.liquidWalletSettings.isLightningEnabled) &&
          didSetLiquid &&
          (!masterInfoObject.enabledEcash || didSetEcashInformation)
        ) {
          const autoWorkData =
            process.env.BOLTZ_ENVIRONMENT === 'testnet' ||
            AppState.currentState !== 'active'
              ? Promise.resolve({didRun: false})
              : autoChannelRebalance({
                  nodeInformation: didSetLightning,
                  liquidNodeInformation: didSetLiquid,
                  masterInfoObject,
                  eCashBalance: didSetEcashInformation.balance,
                  minMaxLiquidSwapAmounts,
                });

          const resolvedData = await autoWorkData;
          console.log('AUTO WORK DATA', resolvedData);

          if (!resolvedData.didRun) {
            replace('HomeAdmin', {screen: 'Home'});

            return;
          }

          if (resolvedData.type == 'reverseSwap') {
            if (resolvedData.isEcash) {
              const meltQuote = await getMeltQuote(resolvedData.invoice);
              if (meltQuote) {
                await payLnInvoiceFromEcash({
                  quote: meltQuote.quote,
                  invoice: resolvedData.invoice,
                  proofsToUse: meltQuote.proofsToUse,
                  description: 'Auto Channel Rebalance',
                });
                replace('HomeAdmin', {screen: 'Home'});
              } else {
                replace('HomeAdmin', {screen: 'Home'});
              }
            } else {
              const parsedInvoice = await parseInput(resolvedData.invoice);
              console.log(parsedInvoice);
              await breezPaymentWrapper({
                paymentInfo: parsedInvoice,
                paymentDescription: 'Auto Channel Rebalance',
                failureFunction: () => {
                  replace('HomeAdmin', {screen: 'Home'});
                },
                confirmFunction: () => {
                  replace('HomeAdmin', {screen: 'Home'});
                },
              });
            }
          } else {
            const response = await breezLiquidPaymentWrapper({
              paymentType: 'bolt11',
              invoice: resolvedData.invoice.lnInvoice.bolt11,
            });

            if (response) replace('HomeAdmin', {screen: 'Home'});
          }
        } else
          throw new Error(
            'Either lightning or liquid node did not set up properly',
          );
      } else throw new Error('something went wrong');
    } catch (err) {
      setHasError(String(err));
      console.log(err, 'homepage connection to node err');
    }
  }
  async function reconnectToLSP(lspInfo) {
    try {
      const availableLsps = lspInfo;
      console.log(availableLsps);

      await connectLsp(availableLsps[0].id);
      return new Promise(resolve => {
        resolve(true);
      });
    } catch (err) {
      console.log(err, 'CONNECTING TO LSP ERROR');

      // setHasError(1);
      return new Promise(resolve => {
        resolve(false);
      });
    }
  }

  async function setupFiatCurrencies() {
    const fiat = await fetchFiatRates();
    const currency = masterInfoObject.fiatCurrency;

    const [fiatRate] = fiat.filter(rate => {
      return rate.coin.toLowerCase() === currency.toLowerCase();
    });
    if (masterInfoObject?.fiatCurrenciesList?.length < 1) {
      const currenies = await listFiatCurrencies();
      const sourted = currenies.sort((a, b) => a.id.localeCompare(b.id));
      toggleMasterInfoObject({fiatCurrenciesList: sourted});
    }

    return fiatRate;
  }

  async function setNodeInformationForSession(retrivedNodeInfo) {
    try {
      const [nodeState, transactions, heath, lspInfo] = await Promise.all([
        retrivedNodeInfo ? Promise.resolve(retrivedNodeInfo) : nodeInfo(),
        getTransactions({}),
        serviceHealthCheck(process.env.API_KEY),
        listLsps(),
      ]);

      const msatToSat = nodeState.channelsBalanceMsat / 1000;
      console.log(nodeState, heath, 'TESTIGg');

      const didConnectToLSP = await (nodeState.connectedPeers.length != 0
        ? Promise.resolve(true)
        : reconnectToLSP(lspInfo));

      if (heath.status !== 'operational')
        throw Error('Breez undergoing maintenence');

      const nodeObject = {
        didConnectToNode: didConnectToLSP,
        transactions: transactions,
        userBalance: msatToSat,
        inboundLiquidityMsat: nodeState.totalInboundLiquidityMsats,
        blockHeight: nodeState.blockHeight,
        onChainBalance: nodeState.onchainBalanceMsat,
        lsp: lspInfo,
      };
      toggleNodeInformation(nodeObject);
      return nodeObject;
    } catch (err) {
      console.log(err, 'TESTING');
      return new Promise(resolve => {
        resolve(false);
      });
    }
  }

  async function setLiquidNodeInformationForSession(retrivedLiquidNodeInfo) {
    try {
      const [parsedInformation, payments, fiat_rate, addressResponse] =
        await Promise.all([
          retrivedLiquidNodeInfo
            ? Promise.resolve(retrivedLiquidNodeInfo)
            : getInfo(),
          listPayments({}),
          setupFiatCurrencies(),
          !globalContactsInformation.myProfile.receiveAddress ||
          isMoreThan7DaysPast(globalContactsInformation.myProfile.lastRotated)
            ? breezLiquidReceivePaymentWrapper({
                paymentType: 'liquid',
              })
            : Promise.resolve(null),
        ]);

      const info = parsedInformation.walletInfo;
      const balanceSat = info.balanceSat;

      if (addressResponse) {
        const {destination, receiveFeesSat} = addressResponse;
        console.log('LIQUID DESTINATION ADDRESS', destination);
        console.log(destination);
        toggleGlobalContactsInformation(
          {
            myProfile: {
              ...globalContactsInformation.myProfile,
              receiveAddress: destination,
              lastRotated: getDateXDaysAgo(0),
            },
          },
          true,
        );
        toggleMasterInfoObject({
          posSettings: {
            ...masterInfoObject.posSettings,
            receiveAddress: destination,
            lastRotated: getDateXDaysAgo(0),
          },
        });
      }

      let liquidNodeObject = {
        transactions: payments,
        userBalance: balanceSat,
        pendingReceive: info.pendingReceiveSat,
        pendingSend: info.pendingSendSat,
      };

      toggleNodeInformation({fiatStats: fiat_rate});

      console.log(
        didRestoreWallet,
        payments.length,
        !payments.length,
        'CHEKCING RETRY LOGIC',
      );

      if (didRestoreWallet) {
        console.log('RETRYING LIQUID INFORMATION, LOADING....');
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log('FINISHED WAITING');

        const [restoreWalletInfo, restoreWalletPayments] = await Promise.all([
          getInfo(),
          listPayments({}),
        ]);

        const restoreWalletBalance = restoreWalletInfo.walletInfo.balanceSat;

        console.log(
          restoreWalletInfo.walletInfo.balanceSat,
          restoreWalletPayments.length,
          'RETRY INFO',
        );

        liquidNodeObject = {
          transactions: restoreWalletPayments,
          userBalance: restoreWalletBalance,
          pendingReceive: restoreWalletInfo.walletInfo.pendingReceiveSat,
          pendingSend: restoreWalletInfo.walletInfo.pendingSendSat,
        };
      }

      toggleLiquidNodeInformation({
        ...liquidNodeObject,
        didConnectToNode: true,
      });

      return liquidNodeObject;
    } catch (err) {
      console.log(err, 'LIQUID INFORMATION ERROR');
      return new Promise(resolve => {
        resolve(false);
      });
    }
  }
  async function setEcashInformationForSession() {
    try {
      const hasSelectedMint = await getSelectedMint();
      if (!hasSelectedMint)
        return {transactions: [], balance: 0, proofs: [], mintURL: ''};
      await initEcashWallet(hasSelectedMint);

      const [transactions, storedProofs, mintList] = await Promise.all([
        getStoredEcashTransactions(),
        getStoredProofs(),
        getAllMints(),
      ]);

      const balance = sumProofsValue(storedProofs);

      const ecashWalletData = {
        mintURL: hasSelectedMint,
        balance: balance || 0,
        transactions: transactions,
        proofs: storedProofs,
        didConnectToNode: true,
      };
      toggleEcashWalletInformation(ecashWalletData);
      toggleMintList(mintList);
      return ecashWalletData;
    } catch (err) {
      console.log('setting ecash information error', err);
      return false;
    }
  }
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingText: {
    width: 300,
    marginTop: 10,
    textAlign: 'center',
    color: COLORS.primary,
  },
  doomsday: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
