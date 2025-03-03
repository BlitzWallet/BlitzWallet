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
import getDeepLinkUser from '../../components/admin/homeComponents/contacts/internalComponents/getDeepLinkUser';
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
  getEcashBalance,
  getMeltQuote,
  initEcashWallet,
  payLnInvoiceFromEcash,
} from '../../functions/eCash/wallet';
import {sumProofsValue} from '../../functions/eCash/proofs';
import {initializePOSTransactionsDatabase} from '../../functions/pos';
export default function ConnectingToNodeLoadingScreen({
  navigation: {reset},
  route,
}) {
  const navigate = useNavigation();
  const {onLightningBreezEvent} = useLightningEvent();
  const {onLiquidBreezEvent} = useLiquidEvent();
  const {
    // toggleNostrSocket,
    // toggleNostrEvents,
    // toggleNostrContacts,
    // nostrContacts,
    toggleMasterInfoObject,
    masterInfoObject,
    setMasterInfoObject,
    // setJWT,
    deepLinkContent,
    setDeepLinkContent,
  } = useGlobalContextProvider();
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
  // const webViewRef = useRef(null);

  //gets data from either firebase or local storage to load users saved settings
  const didLoadInformation = useRef(false);
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
    if (!isInialredner.current) return;
    isInialredner.current = false;

    (async () => {
      const didOpen = await initializeDatabase();
      const ecashTablesOpened = await initEcashDBTables();
      const posTransactions = await initializePOSTransactionsDatabase();
      if (!didOpen || !ecashTablesOpened || !posTransactions) {
        setHasError('Not able to open database');
        return;
      }
      const didSet = await initializeUserSettingsFromHistory({
        setContactsPrivateKey: toggleContactsPrivateKey,
        setMasterInfoObject,
        toggleGlobalContactsInformation,
        toggleGLobalEcashInformation,
        toggleGlobalAppDataInformation,
      });

      //waits for data to be loaded untill login process can start
      if (!didSet) {
        setHasError('Not able to get account information');
        return;
      }
    })();
  }, []);

  useEffect(() => {
    if (
      Object.keys(masterInfoObject).length === 0 ||
      didLoadInformation.current ||
      Object.keys(globalContactsInformation).length === 0
    )
      return;
    didLoadInformation.current = true;

    initWallet();
    claimUnclaimedBoltzSwaps();
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
        const [didSetLightning, didSetLiquid] = await (masterInfoObject
          .liquidWalletSettings.isLightningEnabled
          ? Promise.all([
              setNodeInformationForSession(didConnectToNode?.node_info),
              setLiquidNodeInformationForSession(
                didConnectToLiquidNode?.liquid_node_info,
              ),
            ])
          : Promise.all([
              Promise.resolve({}),
              setLiquidNodeInformationForSession(
                didConnectToLiquidNode?.liquid_node_info,
              ),
            ]));
        const didSetEcashInformation = await setEcashInformationForSession();

        if (
          (didSetLightning ||
            !masterInfoObject.liquidWalletSettings.isLightningEnabled) &&
          didSetLiquid &&
          (!masterInfoObject.enabledEcash || didSetEcashInformation)
        ) {
          if (deepLinkContent.data.length != 0) {
            try {
              if (deepLinkContent.type === 'LN') {
                reset({
                  index: 0, // The top-level route index
                  routes: [
                    {
                      name: 'HomeAdmin', // Navigate to HomeAdmin
                      params: {
                        screen: 'Home',
                      },
                    },
                    {
                      name: 'ConfirmPaymentScreen', // Navigate to ExpandedAddContactsPage
                      params: {
                        btcAdress: deepLinkContent.data,
                      },
                    },
                  ],
                  // Array of routes to set in the stack
                });
              } else if (deepLinkContent.type === 'Contact') {
                const deepLinkContact = await getDeepLinkUser({
                  deepLinkContent: deepLinkContent.data,
                  userProfile: globalContactsInformation.myProfile,
                });

                if (deepLinkContact.didWork) {
                  reset({
                    index: 0, // The top-level route index
                    routes: [
                      {
                        name: 'HomeAdmin', // Navigate to HomeAdmin
                        params: {
                          screen: 'Home',
                        },
                      },
                      {
                        name: 'HomeAdmin', // Navigate to HomeAdmin
                        params: {
                          screen: 'ContactsPageInit',
                        },
                      },
                      {
                        name: 'ExpandedAddContactsPage', // Navigate to ExpandedAddContactsPage
                        params: {
                          newContact: deepLinkContact.data,
                        },
                      },
                    ],
                    // Array of routes to set in the stack
                  });
                } else {
                  reset({
                    index: 0, // The top-level route index
                    routes: [
                      {
                        name: 'HomeAdmin', // Navigate to HomeAdmin
                        params: {
                          screen: 'Home',
                        },
                      },
                      {
                        name: 'ErrorScreen', // Navigate to HomeAdmin
                        params: {
                          errorMessage: `${deepLinkContact.reason}`,
                        },
                      },
                    ],
                    // Array of routes to set in the stack
                  });
                }
              }
            } catch (err) {
              console.log('deep link error', err);
            } finally {
              setDeepLinkContent({type: '', data: ''});
              return;
            }
          }

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
            reset({
              index: 0,
              routes: [
                {
                  name: 'HomeAdmin',
                  params: {
                    screen: 'Home',
                  },
                },
              ],
            });
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
                reset({
                  index: 0,
                  routes: [
                    {
                      name: 'HomeAdmin',
                      params: {
                        screen: 'Home',
                      },
                    },
                  ],
                });
              } else {
                reset({
                  index: 0,
                  routes: [
                    {
                      name: 'HomeAdmin',
                      params: {
                        screen: 'Home',
                      },
                    },
                  ],
                });
              }
            } else {
              const parsedInvoice = await parseInput(resolvedData.invoice);
              console.log(parsedInvoice);
              await breezPaymentWrapper({
                paymentInfo: parsedInvoice,
                paymentDescription: 'Auto Channel Rebalance',
                failureFunction: () => {
                  reset({
                    index: 0,
                    routes: [
                      {
                        name: 'HomeAdmin',
                        params: {
                          screen: 'Home',
                        },
                      },
                    ],
                  });
                },
                confirmFunction: () => {
                  reset({
                    index: 0,
                    routes: [
                      {
                        name: 'HomeAdmin',
                        params: {
                          screen: 'Home',
                        },
                      },
                    ],
                  });
                },
              });
            }
          } else {
            const response = await breezLiquidPaymentWrapper({
              paymentType: 'bolt11',
              invoice: resolvedData.invoice.lnInvoice.bolt11,
            });

            if (response)
              reset({
                index: 0,
                routes: [
                  {
                    name: 'HomeAdmin',
                    params: {
                      screen: 'Home',
                    },
                  },
                ],
              });
          }
        } else
          throw new Error(
            'Either lightning or liquid node did not set up properly',
          );
      } else throw new Error('something went wrong');
    } catch (err) {
      setHasError(String(err));
      setHasError(JSON.stringify(err));
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
      const nodeState = await (retrivedNodeInfo
        ? Promise.resolve(retrivedNodeInfo)
        : nodeInfo());
      const transactions = await getTransactions();
      const heath = await serviceHealthCheck(process.env.API_KEY);
      const msatToSat = nodeState.channelsBalanceMsat / 1000;
      console.log(nodeState, heath, 'TESTIGg');
      // const fiat = await fetchFiatRates();
      const lspInfo = await listLsps();

      // const currency = masterInfoObject.fiatCurrency;
      // const currenies = await listFiatCurrencies();

      // const sourted = currenies.sort((a, b) => a.id.localeCompare(b.id));

      // const [fiatRate] = fiat.filter(rate => {
      //   return rate.coin.toLowerCase() === currency.toLowerCase();
      // });

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
        // fiatStats: fiatRate,
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
      const parsedInformation = await (retrivedLiquidNodeInfo
        ? Promise.resolve(retrivedLiquidNodeInfo)
        : getInfo());
      const info = parsedInformation.walletInfo;
      const balanceSat = info.balanceSat;
      const payments = await listPayments({});
      const fiat_rate = await setupFiatCurrencies();

      if (
        !globalContactsInformation.myProfile.receiveAddress ||
        isMoreThan7DaysPast(globalContactsInformation.myProfile.lastRotated)
      ) {
        const addressResponse = await breezLiquidReceivePaymentWrapper({
          paymentType: 'liquid',
        });
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

      if (didRestoreWallet && !payments.length) {
        console.log('RETRYING LIQUID INFORMATION, LOADING....');
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log('FINISHED WAITING');

        const restoreWalletInfo = await getInfo();

        const restoreWalletBalance = restoreWalletInfo.walletInfo.balanceSat;
        const restoreWalletPayments = await listPayments({});

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

      toggleLiquidNodeInformation(liquidNodeObject);

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
      const transactions = await getStoredEcashTransactions();
      const storedProofs = await getStoredProofs();
      const balance = sumProofsValue(storedProofs);
      const mintList = await getAllMints();

      const ecashWalletData = {
        mintURL: hasSelectedMint,
        balance: balance || 0,
        transactions: transactions,
        proofs: storedProofs,
      };
      toggleEcashWalletInformation(ecashWalletData);
      toggleMintList(mintList);
      return ecashWalletData;
    } catch (err) {
      console.log('setting ecash information error', err);
      throw new Error('Unable to load ecash wallet');
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
