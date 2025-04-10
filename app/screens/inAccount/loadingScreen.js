import {
  AppState,
  Platform,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {COLORS, FONT, ICONS} from '../../constants';
import {useGlobalContextProvider} from '../../../context-store/context';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import CustomButton from '../../functions/CustomElements/button';
import {INSET_WINDOW_WIDTH} from '../../constants/theme';
import {
  applyErrorAnimationTheme,
  updateMascatWalkingAnimation,
} from '../../functions/lottieViewColorTransformer';
import {crashlyticsLogReport} from '../../functions/crashlyticsLogs';
const mascotAnimation = require('../../assets/MOSCATWALKING.json');
const confirmTxAnimationDarkMode = require('../../assets/errorTxAnimation.json');

export default function ConnectingToNodeLoadingScreen({
  navigation: {replace},
  route,
}) {
  const navigate = useNavigation();
  const window = useWindowDimensions();
  const {onLightningBreezEvent} = useLightningEvent();
  const {onLiquidBreezEvent} = useLiquidEvent();
  const {toggleMasterInfoObject, masterInfoObject, setMasterInfoObject} =
    useGlobalContextProvider();
  const {toggleContactsPrivateKey} = useKeysContext();
  const {minMaxLiquidSwapAmounts, toggleMinMaxLiquidSwapAmounts} =
    useAppStatus();
  const {toggleNodeInformation, toggleLiquidNodeInformation} = useNodeContext();
  const {theme, darkModeType} = useGlobalThemeContext();
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
  const [showLNErrorScreen, setShowLNErrorScreen] = useState(false);
  const [loadingLNFailedSettings, setLoadingLNFailedSettings] = useState(false);
  const isInialredner = useRef(true);

  const transformedAnimation = useMemo(() => {
    return updateMascatWalkingAnimation(
      mascotAnimation,
      theme ? 'white' : 'blue',
    );
  }, [theme]);

  const errorAnimation = useMemo(() => {
    return applyErrorAnimationTheme(
      confirmTxAnimationDarkMode,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

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
        crashlyticsLogReport(
          'Begining app connnection procress in loading screen',
        );
        const [didOpen, ecashTablesOpened, posTransactions] = await Promise.all(
          [
            initializeDatabase(),
            initEcashDBTables(),
            initializePOSTransactionsDatabase(),
          ],
        );
        if (!didOpen || !ecashTablesOpened || !posTransactions)
          throw new Error('Database initialization failed');
        crashlyticsLogReport('Opened all SQL lite tables');
        const didLoadUserSettings = await initializeUserSettingsFromHistory({
          setContactsPrivateKey: toggleContactsPrivateKey,
          setMasterInfoObject,
          toggleGlobalContactsInformation,
          toggleGLobalEcashInformation,
          toggleGlobalAppDataInformation,
        });
        if (!didLoadUserSettings)
          throw new Error('Failed to load user settings');
        crashlyticsLogReport('Loaded users settings from firebase');
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
    crashlyticsLogReport('Initializing wallet settings');

    initWallet();
  }, [masterInfoObject, globalContactsInformation]);

  const continueWithoutLN = useCallback(async () => {
    if (loadingLNFailedSettings) return;
    try {
      setLoadingLNFailedSettings(true);
      await Promise.all([
        setLiquidNodeInformationForSession(),
        setEcashInformationForSession(),
      ]);
      toggleMasterInfoObject(
        {
          liquidWalletSettings: {
            ...masterInfoObject.liquidWalletSettings,
            isLightningEnabled: false,
          },
        },
        false,
      );
      replace('HomeAdmin', {screen: 'Home'});
    } catch (err) {
      console.log(err, 'continue without ln error');
    }
  }, [toggleMasterInfoObject, masterInfoObject, loadingLNFailedSettings]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={styles.globalContainer}>
        {showLNErrorScreen ? (
          <View style={{alignItems: 'center', width: '100%'}}>
            <LottieView
              source={errorAnimation}
              autoPlay
              loop={false}
              style={{
                width: window.width * 0.6,
                height: window.width * 0.6,
              }}
            />

            <ThemeText
              styles={{
                textAlign: 'center',
                marginBottom: 50,
                width: INSET_WINDOW_WIDTH,
              }}
              content={
                'There was a problem setting up your Lightning node. Would you like to continue without lightning?'
              }
            />
            <CustomButton
              useLoading={loadingLNFailedSettings}
              actionFunction={continueWithoutLN}
              textContent={'Continue'}
            />
          </View>
        ) : (
          <>
            {hasError && (
              <TouchableOpacity
                onPress={() =>
                  navigate.navigate('SettingsHome', {isDoomsday: true})
                }
                style={styles.doomsday}>
                <ThemeImage
                  lightModeIcon={ICONS.settingsIcon}
                  darkModeIcon={ICONS.settingsIcon}
                  lightsOutIcon={ICONS.settingsWhite}
                />
              </TouchableOpacity>
            )}
            <LottieView
              source={transformedAnimation}
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
          </>
        )}
      </View>
    </GlobalThemeView>
  );

  async function initWallet() {
    console.log('HOME RENDER BREEZ EVENT FIRST LOAD');
    // initBalanceAndTransactions(toggleNodeInformation);

    try {
      crashlyticsLogReport('Trying to connect to nodes');
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
      console.log(
        didConnectToNode?.isConnected,
        !masterInfoObject.liquidWalletSettings.isLightningEnabled,
        didConnectToLiquidNode?.isConnected,
        'DID CONNECT TO NODE',
      );
      if (
        (didConnectToNode?.isConnected ||
          !masterInfoObject.liquidWalletSettings.isLightningEnabled) &&
        didConnectToLiquidNode?.isConnected
      ) {
        crashlyticsLogReport('Loading node balances for session');
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
        console.log(
          didSetLightning,
          didSetLiquid,
          didSetEcashInformation,
          'DID SET INFORMATION',
        );
        if (
          (didSetLightning ||
            !masterInfoObject.liquidWalletSettings.isLightningEnabled) &&
          didSetLiquid &&
          (!masterInfoObject.enabledEcash || didSetEcashInformation)
        ) {
          crashlyticsLogReport('Trying auto channel rebalance');
          const autoWorkData =
            process.env.BOLTZ_ENVIRONMENT === 'testnet' ||
            AppState.currentState !== 'active'
              ? Promise.resolve({didRun: false})
              : autoChannelRebalance({
                  nodeInformation: didSetLightning,
                  liquidNodeInformation: didSetLiquid,
                  masterInfoObject,
                  // eCashBalance: didSetEcashInformation.balance,
                  minMaxLiquidSwapAmounts,
                });

          const resolvedData = await autoWorkData;
          console.log('AUTO WORK DATA', resolvedData);

          if (!resolvedData.didRun) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                replace('HomeAdmin', {screen: 'Home'});
              });
            });
            return;
          }

          if (resolvedData.type == 'reverseSwap') {
            // if (resolvedData.isEcash) {
            //   const meltQuote = await getMeltQuote(resolvedData.invoice);
            //   if (meltQuote) {
            //     await payLnInvoiceFromEcash({
            //       quote: meltQuote.quote,
            //       invoice: resolvedData.invoice,
            //       proofsToUse: meltQuote.proofsToUse,
            //       description: 'Auto Channel Rebalance',
            //     });
            //     replace('HomeAdmin', {screen: 'Home'});
            //   } else {
            //     replace('HomeAdmin', {screen: 'Home'});
            //   }
            // } else {
            const parsedInvoice = await parseInput(resolvedData.invoice);
            console.log(parsedInvoice);
            await breezPaymentWrapper({
              paymentInfo: parsedInvoice,
              paymentDescription: 'Auto Channel Rebalance',
              failureFunction: () => {
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    replace('HomeAdmin', {screen: 'Home'});
                  });
                });
              },
              confirmFunction: () => {
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    replace('HomeAdmin', {screen: 'Home'});
                  });
                });
              },
            });
            // }
          } else {
            const response = await breezLiquidPaymentWrapper({
              paymentType: 'bolt11',
              invoice: resolvedData.invoice.lnInvoice.bolt11,
            });

            if (response)
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  replace('HomeAdmin', {screen: 'Home'});
                });
              });
          }
        } else
          throw new Error(
            'Either lightning or liquid node did not set up properly',
          );
      } else {
        if (
          !didConnectToNode.isConnected &&
          didConnectToLiquidNode?.isConnected
        ) {
          setShowLNErrorScreen(true);
          return;
        }
        throw new Error('Something went wrong during setup, try again.');
      }
    } catch (err) {
      setHasError(String(err.message));
      crashlyticsLogReport(err.message);
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
      crashlyticsLogReport('Starting lightning node lookup process');
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
      crashlyticsLogReport('Starting liquid node lookup process');
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
      crashlyticsLogReport('Starting ecash node lookup process');
      if (!masterInfoObject.enabledEcash) {
        return {
          transactions: [],
          balance: 0,
          proofs: [],
          mintURL: '',
          didConnectToNode: false,
        };
      }
      const hasSelectedMint = await getSelectedMint();
      if (!hasSelectedMint)
        return {
          transactions: [],
          balance: 0,
          proofs: [],
          mintURL: '',
          didConnectToNode: false,
        };
      const timeoutPromise = new Promise(resolve =>
        setTimeout(() => {
          console.log('Timeout reached: Returning fallback data');
          resolve({
            transactions: [],
            balance: 0,
            proofs: [],
            mintURL: '',
            didConnectToNode: false,
          });
        }, 15000),
      );
      const initPromise = (async () => {
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
      })();
      return await Promise.race([initPromise, timeoutPromise]);
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
