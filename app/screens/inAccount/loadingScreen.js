import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {COLORS, ICONS} from '../../constants';
import {useGlobalContextProvider} from '../../../context-store/context';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import initializeUserSettingsFromHistory from '../../functions/initializeUserSettings';
import claimUnclaimedBoltzSwaps from '../../functions/boltz/claimUnclaimedTxs';
import {useGlobalContacts} from '../../../context-store/globalContacts';
import {
  getDateXDaysAgo,
  isMoreThan7DaysPast,
  isMoreThanADayOld,
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
  // listPayments,
} from '@breeztech/react-native-breez-sdk-liquid';
import connectToLiquidNode from '../../functions/connectToLiquid';
import {initializeDatabase} from '../../functions/messaging/cachedMessages';
import {useGlobalThemeContext} from '../../../context-store/theme';
import {useNodeContext} from '../../../context-store/nodeContext';
import {useKeysContext} from '../../../context-store/keys';
import {initEcashDBTables} from '../../functions/eCash/db';
import {initializePOSTransactionsDatabase} from '../../functions/pos';
import {updateMascatWalkingAnimation} from '../../functions/lottieViewColorTransformer';
import {crashlyticsLogReport} from '../../functions/crashlyticsLogs';
import {useSparkWallet} from '../../../context-store/sparkContext';
import {initializeSparkDatabase} from '../../functions/spark/transactions';
import {getCachedSparkTransactions} from '../../functions/spark';
import {breezLiquidReceivePaymentWrapper} from '../../functions/breezLiquid';
import {getLocalStorageItem, setLocalStorageItem} from '../../functions';
import {useLiquidEvent} from '../../../context-store/liquidEventContext';
import {initRootstockSwapDB} from '../../functions/boltz/rootstock/swapDb';
import {useRootstockProvider} from '../../../context-store/rootstockSwapContext';
const mascotAnimation = require('../../assets/MOSCATWALKING.json');

export default function ConnectingToNodeLoadingScreen({
  navigation: {replace},
  route,
}) {
  const navigate = useNavigation();
  const {toggleMasterInfoObject, masterInfoObject, setMasterInfoObject} =
    useGlobalContextProvider();
  const {setNumberOfCachedTxs, connectToSparkWallet} = useSparkWallet();
  const {toggleContactsPrivateKey, accountMnemoinc} = useKeysContext();
  const {toggleLiquidNodeInformation, toggleFiatStats} = useNodeContext();
  const {createSigner} = useRootstockProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {toggleGlobalContactsInformation, globalContactsInformation} =
    useGlobalContacts();
  const {startLiquidEventListener} = useLiquidEvent();
  // const {
  //   toggleGLobalEcashInformation,
  //   toggleEcashWalletInformation,
  //   toggleMintList,
  // } = useGlobaleCash();

  const {toggleGlobalAppDataInformation} = useGlobalAppData();
  const [hasError, setHasError] = useState(null);
  const {t} = useTranslation();
  const [message, setMessage] = useState(t('loadingScreen.message1'));
  const [didOpenDatabases, setDidOpenDatabases] = useState(false);

  const didLoadInformation = useRef(false);

  // const didRestoreWallet = route?.params?.didRestoreWallet;
  const liquidNodeConnectionRef = useRef(null);
  const numberOfCachedTransactionsRef = useRef(null);
  const didStartConnectionRef = useRef(null);

  // const window = useWindowDimensions();
  // const {onLightningBreezEvent} = useLightningEvent();=
  // const {toggleContactsPrivateKey, accountMnemoinc} = useKeysContext();
  // const {minMaxLiquidSwapAmounts, toggleMinMaxLiquidSwapAmounts} =
  // useAppStatus();
  // const {toggleNodeInformation, toggleLiquidNodeInformation} = useNodeContext();
  // const {toggleGlobalContactsInformation, globalContactsInformation} =
  //   useGlobalContacts();

  //gets data from either firebase or local storage to load users saved settings

  // const [showLNErrorScreen, setShowLNErrorScreen] = useState(false);
  // const [loadingLNFailedSettings, setLoadingLNFailedSettings] = useState(false);
  // const isInialredner = useRef(true);

  const transformedAnimation = useMemo(() => {
    return updateMascatWalkingAnimation(
      mascotAnimation,
      theme ? 'white' : 'blue',
    );
  }, [theme]);

  // const errorAnimation = useMemo(() => {
  //   return applyErrorAnimationTheme(
  //     confirmTxAnimationDarkMode,
  //     theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
  //   );
  // }, [theme, darkModeType]);

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
        console.log('Process 1', new Date().getTime());
        connectToSparkWallet();
        const [
          didOpen,
          ecashTablesOpened,
          posTransactions,
          sparkTxs,
          rootstockSwaps,
        ] = await Promise.all([
          initializeDatabase(),
          initEcashDBTables(),
          initializePOSTransactionsDatabase(),
          initializeSparkDatabase(),
          initRootstockSwapDB(),
        ]);
        // DO tables need to open before these other processes???/

        if (
          !didOpen ||
          !ecashTablesOpened ||
          !posTransactions ||
          !sparkTxs ||
          !rootstockSwaps
        )
          throw new Error('Database initialization failed');

        console.log('Process 2', new Date().getTime());
        crashlyticsLogReport('Opened all SQL lite tables');
        const [
          didConnectToLiquidNode,
          txs,
          didLoadUserSettings,
          signerResponse,
        ] = await Promise.all([
          connectToLiquidNode(accountMnemoinc),
          getCachedSparkTransactions(),
          initializeUserSettingsFromHistory({
            accountMnemoinc,
            setContactsPrivateKey: toggleContactsPrivateKey,
            setMasterInfoObject,
            toggleGlobalContactsInformation,
            // toggleGLobalEcashInformation,
            toggleGlobalAppDataInformation,
          }),
          createSigner(),
        ]);

        liquidNodeConnectionRef.current = didConnectToLiquidNode;
        numberOfCachedTransactionsRef.current = txs;

        if (!didLoadUserSettings)
          throw new Error('Failed to load user settings');
        crashlyticsLogReport('Loaded users settings from firebase');
        claimUnclaimedBoltzSwaps();
        setDidOpenDatabases(true);
        console.log('Process 3', new Date().getTime());
      } catch (err) {
        console.log('intializatiion error', err);
        setHasError(err.message);
      }
    }
    if (didStartConnectionRef.current) return;
    didStartConnectionRef.current = true;
    startConnectProcess();
  }, []);

  useEffect(() => {
    if (
      Object.keys(masterInfoObject).length === 0 ||
      didLoadInformation.current ||
      Object.keys(globalContactsInformation).length === 0 ||
      !didOpenDatabases
    )
      return;
    didLoadInformation.current = true;
    crashlyticsLogReport('Initializing wallet settings');

    console.log('Process 4', new Date().getTime());
    initWallet(
      liquidNodeConnectionRef.current,
      numberOfCachedTransactionsRef.current,
    );
  }, [masterInfoObject, globalContactsInformation, didOpenDatabases]);

  // const continueWithoutLN = useCallback(async () => {
  //   if (loadingLNFailedSettings) return;
  //   try {
  //     setLoadingLNFailedSettings(true);
  //     await Promise.all([
  //       setLiquidNodeInformationForSession(),
  //       setEcashInformationForSession(),
  //     ]);
  //     toggleMasterInfoObject(
  //       {
  //         liquidWalletSettings: {
  //           ...masterInfoObject.liquidWalletSettings,
  //           isLightningEnabled: false,
  //         },
  //       },
  //       false,
  //     );
  //     replace('HomeAdmin', {screen: 'Home'});
  //   } catch (err) {
  //     console.log(err, 'continue without ln error');
  //   }
  // }, [toggleMasterInfoObject, masterInfoObject, loadingLNFailedSettings]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={styles.globalContainer}>
        {/* {showLNErrorScreen ? (
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
          <> */}
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
        {/* </>
        )} */}
      </View>
    </GlobalThemeView>
  );

  async function initWallet(didConnectToLiquidNode, txs) {
    console.log('HOME RENDER BREEZ EVENT FIRST LOAD');
    // initBalanceAndTransactions(toggleNodeInformation);

    try {
      console.log('Process 5', new Date().getTime());
      crashlyticsLogReport('Trying to connect to nodes');
      setNumberOfCachedTxs(txs?.length || 0);
      if (didConnectToLiquidNode.isConnected) {
        crashlyticsLogReport('Loading node balances for session');
        console.log('Process 6', new Date().getTime());
        const didSetLiquid = await setLiquidNodeInformationForSession();
        // didConnectToLiquidNode?.liquid_node_info,

        console.log('Process 19', new Date().getTime());
        if (didSetLiquid) {
          console.log('Process 20', new Date().getTime());
          // navigate.preload('HomeAdmin');
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              console.log('Process 21', new Date().getTime());
              replace('HomeAdmin', {screen: 'Home'});
            });
          });
        } else
          throw new Error(
            'Wallet information was not set properly, please try again.',
          );
      } else {
        throw new Error(
          'We were unable to set up your wallet. Please try again.',
        );
      }
      // if (
      //   (didConnectToNode?.isConnected ||
      //     !masterInfoObject.liquidWalletSettings.isLightningEnabled) &&
      //   didConnectToLiquidNode?.isConnected
      // ) {
      //   crashlyticsLogReport('Loading node balances for session');
      //   const [didSetLightning, didSetLiquid, didSetEcashInformation] =
      //     await (masterInfoObject.liquidWalletSettings.isLightningEnabled
      //       ? Promise.all([
      //           setNodeInformationForSession(didConnectToNode?.node_info),
      //           setLiquidNodeInformationForSession(
      //             didConnectToLiquidNode?.liquid_node_info,
      //           ),
      //           setEcashInformationForSession(),
      //         ])
      //       : Promise.all([
      //           Promise.resolve({}),
      //           setLiquidNodeInformationForSession(
      //             didConnectToLiquidNode?.liquid_node_info,
      //           ),
      //           setEcashInformationForSession(),
      //         ]));
      //   console.log(
      //     didSetLightning,
      //     didSetLiquid,
      //     didSetEcashInformation,
      //     'DID SET INFORMATION',
      //   );
      //   if (
      //     (didSetLightning ||
      //       !masterInfoObject.liquidWalletSettings.isLightningEnabled) &&
      //     didSetLiquid &&
      //     (!masterInfoObject.enabledEcash || didSetEcashInformation)
      //   ) {
      //     crashlyticsLogReport('Trying auto channel rebalance');
      //     const autoWorkData =
      //       process.env.BOLTZ_ENVIRONMENT === 'testnet' ||
      //       AppState.currentState !== 'active'
      //         ? Promise.resolve({didRun: false})
      //         : autoChannelRebalance({
      //             nodeInformation: didSetLightning,
      //             liquidNodeInformation: didSetLiquid,
      //             masterInfoObject,
      //             // eCashBalance: didSetEcashInformation.balance,
      //             minMaxLiquidSwapAmounts,
      //           });

      //     const resolvedData = await autoWorkData;
      //     console.log('AUTO WORK DATA', resolvedData);

      //     if (!resolvedData.didRun) {
      //       requestAnimationFrame(() => {
      //         requestAnimationFrame(() => {
      //           replace('HomeAdmin', {screen: 'Home'});
      //         });
      //       });
      //       return;
      //     }

      //     if (resolvedData.type == 'reverseSwap') {
      //       // if (resolvedData.isEcash) {
      //       //   const meltQuote = await getMeltQuote(resolvedData.invoice);
      //       //   if (meltQuote) {
      //       //     await payLnInvoiceFromEcash({
      //       //       quote: meltQuote.quote,
      //       //       invoice: resolvedData.invoice,
      //       //       proofsToUse: meltQuote.proofsToUse,
      //       //       description: 'Auto Channel Rebalance',
      //       //     });
      //       //     replace('HomeAdmin', {screen: 'Home'});
      //       //   } else {
      //       //     replace('HomeAdmin', {screen: 'Home'});
      //       //   }
      //       // } else {
      //       const parsedInvoice = await parseInput(resolvedData.invoice);
      //       console.log(parsedInvoice);
      //       await breezPaymentWrapper({
      //         paymentInfo: parsedInvoice,
      //         paymentDescription: 'Auto Channel Rebalance',
      //         failureFunction: () => {
      //           requestAnimationFrame(() => {
      //             requestAnimationFrame(() => {
      //               replace('HomeAdmin', {screen: 'Home'});
      //             });
      //           });
      //         },
      //         confirmFunction: () => {
      //           requestAnimationFrame(() => {
      //             requestAnimationFrame(() => {
      //               replace('HomeAdmin', {screen: 'Home'});
      //             });
      //           });
      //         },
      //       });
      //       // }
      //     } else {
      //       const response = await breezLiquidPaymentWrapper({
      //         paymentType: 'bolt11',
      //         invoice: resolvedData.invoice.lnInvoice.bolt11,
      //       });

      //       if (response)
      //         requestAnimationFrame(() => {
      //           requestAnimationFrame(() => {
      //             replace('HomeAdmin', {screen: 'Home'});
      //           });
      //         });
      //     }
      //   } else
      //     throw new Error(
      //       'Either lightning or liquid node did not set up properly',
      //     );
      // } else {
      //   if (
      //     !didConnectToNode.isConnected &&
      //     didConnectToLiquidNode?.isConnected
      //   ) {
      //     setShowLNErrorScreen(true);
      //     return;
      //   }
      //   throw new Error('Something went wrong during setup, try again.');
      // }
    } catch (err) {
      setHasError(String(err.message));
      crashlyticsLogReport(err.message);
      console.log(err, 'homepage connection to node err');
    }
  }
  // async function reconnectToLSP(lspInfo) {
  //   try {
  //     const availableLsps = lspInfo;
  //     console.log(availableLsps);

  //     await connectLsp(availableLsps[0].id);
  //     return new Promise(resolve => {
  //       resolve(true);
  //     });
  //   } catch (err) {
  //     console.log(err, 'CONNECTING TO LSP ERROR');

  //     // setHasError(1);
  //     return new Promise(resolve => {
  //       resolve(false);
  //     });
  //   }
  // }

  async function setupFiatCurrencies() {
    console.log('Process 8', new Date().getTime());
    const fetchResponse = JSON.parse(
      await getLocalStorageItem('didFetchFiatRateToday'),
    ) || {
      lastFetched: new Date().getTime() - 1000 * 60 * 60 * 24 * 30,
      rates: [],
    };

    const currency = masterInfoObject.fiatCurrency;

    console.log('Process 9', new Date().getTime());
    // Return cached data if still fresh
    if (!isMoreThanADayOld(fetchResponse.lastFetched)) {
      const [fiatRate] = fetchResponse.rates.filter(
        rate => rate.coin.toLowerCase() === currency.toLowerCase(),
      );
      if (fiatRate) return fiatRate;
    }

    console.log('Process 10', new Date().getTime());
    let [fiat, fiatCurrencies] = await Promise.all([
      withTimeout(fetchFiatRates(), 5000, null),
      masterInfoObject?.fiatCurrenciesList?.length < 1
        ? listFiatCurrencies()
        : Promise.resolve(null),
    ]);

    console.log('Process 11', new Date().getTime());
    if (!fiat) {
      try {
        const response = await fetch(process.env.FALLBACK_FIAT_PRICE_DATA);
        const data = await response.json();
        fiat = Object.keys(data).map(coin => ({
          coin: coin,
          value: data[coin]['15m'],
        }));
      } catch (error) {
        console.error('Failed to fetch fallback fiat data:', error);
        return {coin: 'USD', value: 100_000};
      }
    }

    console.log('Process 12', new Date().getTime());
    const [fiatRate] = fiat.filter(
      rate => rate.coin.toLowerCase() === currency.toLowerCase(),
    );
    const [usdRate] = fiat.filter(rate => rate.coin.toLowerCase() === 'usd');

    if (!fiatRate && usdRate) {
      toggleMasterInfoObject({fiatCurrency: 'USD'});
    }

    console.log('Process 13', new Date().getTime());
    await setLocalStorageItem(
      'didFetchFiatRateToday',
      JSON.stringify({
        lastFetched: new Date().getTime(),
        rates: fiat,
      }),
    );

    console.log('Process 14', new Date().getTime());
    if (fiatCurrencies) {
      try {
        const sorted = fiatCurrencies.sort((a, b) => a.id.localeCompare(b.id));
        toggleMasterInfoObject({fiatCurrenciesList: sorted});
      } catch (error) {
        console.error('Failed to fetch currencies list:', error);
      }
    }

    console.log('Process 15', new Date().getTime());
    return fiatRate || usdRate;
  }

  // async function setNodeInformationForSession(retrivedNodeInfo) {
  //   try {
  //     crashlyticsLogReport('Starting lightning node lookup process');
  //     const [nodeState, transactions, heath, lspInfo] = await Promise.all([
  //       retrivedNodeInfo ? Promise.resolve(retrivedNodeInfo) : nodeInfo(),
  //       getTransactions({}),
  //       serviceHealthCheck(process.env.API_KEY),
  //       listLsps(),
  //     ]);

  //     const msatToSat = nodeState.channelsBalanceMsat / 1000;
  //     console.log(nodeState, heath, 'TESTIGg');

  //     const didConnectToLSP = await (nodeState.connectedPeers.length != 0
  //       ? Promise.resolve(true)
  //       : reconnectToLSP(lspInfo));

  //     if (heath.status !== 'operational')
  //       throw Error('Breez undergoing maintenence');

  //     const nodeObject = {
  //       didConnectToNode: didConnectToLSP,
  //       transactions: transactions,
  //       userBalance: msatToSat,
  //       inboundLiquidityMsat: nodeState.totalInboundLiquidityMsats,
  //       blockHeight: nodeState.blockHeight,
  //       onChainBalance: nodeState.onchainBalanceMsat,
  //       lsp: lspInfo,
  //     };
  //     toggleNodeInformation(nodeObject);
  //     return nodeObject;
  //   } catch (err) {
  //     console.log(err, 'TESTING');
  //     return new Promise(resolve => {
  //       resolve(false);
  //     });
  //   }
  // }

  async function setLiquidNodeInformationForSession(retrivedLiquidNodeInfo) {
    try {
      crashlyticsLogReport('Starting liquid node lookup process');
      console.log('Process 7', new Date().getTime());
      const [
        // parsedInformation,
        fiat_rate,
        //  addressResponse
      ] = await Promise.all([
        // withTimeout(
        //   retrivedLiquidNodeInfo
        //     ? Promise.resolve(retrivedLiquidNodeInfo)
        //     : getInfo(),
        //   8000,
        //   {},
        // ),
        setupFiatCurrencies(),
        // !globalContactsInformation.myProfile.receiveAddress
        //   ? breezLiquidReceivePaymentWrapper({paymentType: 'liquid'})
        //   : Promise.resolve(null),
      ]);

      console.log('Process 16', new Date().getTime());
      startLiquidEventListener(3);

      console.log('Process 17', new Date().getTime());
      console.log(fiat_rate, 'hty');

      // const info = parsedInformation.walletInfo;
      // const balanceSat = info?.balanceSat;

      // if (addressResponse) {
      //   const {destination, receiveFeesSat} = addressResponse;
      //   console.log('LIQUID DESTINATION ADDRESS', destination);
      //   console.log(destination);
      //   // For legacy users and legacy functions
      //   toggleGlobalContactsInformation(
      //     {
      //       myProfile: {
      //         ...globalContactsInformation.myProfile,
      //         receiveAddress: destination,
      //         lastRotated: getDateXDaysAgo(0),
      //       },
      //     },
      //     true,
      //   );

      //   // Didn't sperate since it only cost one write so there is no reasy not to update
      //   // toggleMasterInfoObject({
      //   //   posSettings: {
      //   //     ...masterInfoObject.posSettings,
      //   //     receiveAddress: destination,
      //   //     lastRotated: getDateXDaysAgo(0),
      //   //   },
      //   //   offlineReceiveAddresses: {
      //   //     addresses: [
      //   //       destination,
      //   //       ...masterInfoObject.offlineReceiveAddresses.addresses.slice(0, 6),
      //   //     ],
      //   //     lastRotated: new Date().getTime(),
      //   //   },
      //   // });
      // }

      // let liquidNodeObject = {
      //   userBalance: balanceSat || 0,
      //   pendingReceive: info?.pendingReceiveSat || 0,
      //   pendingSend: info?.pendingSendSat || 0,
      // };

      console.log('Process 18', new Date().getTime());
      toggleFiatStats(fiat_rate);

      // console.log(
      //   didRestoreWallet,
      //   payments.length,
      //   !payments.length,
      //   'CHEKCING RETRY LOGIC',
      // );

      // if (didRestoreWallet) {
      //   console.log('RETRYING LIQUID INFORMATION, LOADING....');
      //   await new Promise(resolve => setTimeout(resolve, 10000));
      //   console.log('FINISHED WAITING');

      //   const [restoreWalletInfo, restoreWalletPayments] = await Promise.all([
      //     getInfo(),
      //     listPayments({}),
      //   ]);

      //   const restoreWalletBalance = restoreWalletInfo.walletInfo.balanceSat;

      //   console.log(
      //     restoreWalletInfo.walletInfo.balanceSat,
      //     restoreWalletPayments.length,
      //     'RETRY INFO',
      //   );

      //   liquidNodeObject = {
      //     transactions: restoreWalletPayments,
      //     userBalance: restoreWalletBalance,
      //     pendingReceive: restoreWalletInfo.walletInfo.pendingReceiveSat,
      //     pendingSend: restoreWalletInfo.walletInfo.pendingSendSat,
      //   };
      // }

      toggleLiquidNodeInformation({
        // ...liquidNodeObject,
        didConnectToNode: true,
      });

      return true;
    } catch (err) {
      console.log(err, 'LIQUID INFORMATION ERROR');
      return new Promise(resolve => {
        resolve(false);
      });
    }
  }
  // async function setEcashInformationForSession() {
  //   try {
  //     crashlyticsLogReport('Starting ecash node lookup process');
  //     if (!masterInfoObject.enabledEcash) {
  //       return {
  //         transactions: [],
  //         balance: 0,
  //         proofs: [],
  //         mintURL: '',
  //         didConnectToNode: false,
  //       };
  //     }
  //     const hasSelectedMint = await getSelectedMint();
  //     if (!hasSelectedMint)
  //       return {
  //         transactions: [],
  //         balance: 0,
  //         proofs: [],
  //         mintURL: '',
  //         didConnectToNode: false,
  //       };
  //     const timeoutPromise = new Promise(resolve =>
  //       setTimeout(() => {
  //         console.log('Timeout reached: Returning fallback data');
  //         resolve({
  //           transactions: [],
  //           balance: 0,
  //           proofs: [],
  //           mintURL: '',
  //           didConnectToNode: false,
  //         });
  //       }, 15000),
  //     );
  //     const initPromise = (async () => {
  //       await initEcashWallet(hasSelectedMint, accountMnemoinc);
  //       const [transactions, storedProofs, mintList] = await Promise.all([
  //         getStoredEcashTransactions(),
  //         getStoredProofs(),
  //         getAllMints(),
  //       ]);

  //       const balance = sumProofsValue(storedProofs);

  //       const ecashWalletData = {
  //         mintURL: hasSelectedMint,
  //         balance: balance || 0,
  //         transactions: transactions,
  //         proofs: storedProofs,
  //         didConnectToNode: true,
  //       };
  //       toggleEcashWalletInformation(ecashWalletData);
  //       toggleMintList(mintList);
  //       return ecashWalletData;
  //     })();
  //     return await Promise.race([initPromise, timeoutPromise]);
  //   } catch (err) {
  //     console.log('setting ecash information error', err);
  //     return false;
  //   }
  // }
}
function withTimeout(promise, ms, fallback = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
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
