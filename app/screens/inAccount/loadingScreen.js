import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS, ICONS } from '../../constants';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import initializeUserSettingsFromHistory from '../../functions/initializeUserSettings';
// import claimUnclaimedBoltzSwaps from '../../functions/boltz/claimUnclaimedTxs';
import { useGlobalContacts } from '../../../context-store/globalContacts';
import { useGlobalAppData } from '../../../context-store/appData';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import LottieView from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';
import ThemeImage from '../../functions/CustomElements/themeImage';
// import connectToLiquidNode from '../../functions/connectToLiquid';
// import { initializeDatabase } from '../../functions/messaging/cachedMessages';
import { useGlobalThemeContext } from '../../../context-store/theme';
// import { useNodeContext } from '../../../context-store/nodeContext';
import { useKeysContext } from '../../../context-store/keys';
// import { initializePOSTransactionsDatabase } from '../../functions/pos';
import { updateMascatWalkingAnimation } from '../../functions/lottieViewColorTransformer';
import { crashlyticsLogReport } from '../../functions/crashlyticsLogs';
import { useSparkWallet } from '../../../context-store/sparkContext';
// import { initializeSparkDatabase } from '../../functions/spark/transactions';
// import { getCachedSparkTransactions } from '../../functions/spark';
// import { getLocalStorageItem, setLocalStorageItem } from '../../functions';
// import { useLiquidEvent } from '../../../context-store/liquidEventContext';
// import { initRootstockSwapDB } from '../../functions/boltz/rootstock/swapDb';
import { useRootstockProvider } from '../../../context-store/rootstockSwapContext';
// import loadNewFiatData from '../../functions/saveAndUpdateFiatData';
// import { initializeGiftCardDatabase } from '../../functions/contacts/giftCardStorage';
// import { useWebView } from '../../../context-store/webViewContext';
const mascotAnimation = require('../../assets/MOSCATWALKING.json');

export default function ConnectingToNodeLoadingScreen({
  navigation: { replace },
  route,
}) {
  // const { sendWebViewRequest } = useWebView();
  const navigate = useNavigation();
  const {
    toggleMasterInfoObject,
    // masterInfoObject,
    setMasterInfoObject,
    preloadedUserData,
    setPreLoadedUserData,
  } = useGlobalContextProvider();
  // const { contactsPrivateKey, publicKey } = useKeysContext();
  const {
    // setNumberOfCachedTxs,
    connectToSparkWallet,
  } = useSparkWallet();
  const { toggleContactsPrivateKey, accountMnemoinc } = useKeysContext();
  // const {
  //   // toggleLiquidNodeInformation,
  //   toggleFiatStats,
  // } = useNodeContext();
  const { createSigner } = useRootstockProvider();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { toggleGlobalContactsInformation, globalContactsInformation } =
    useGlobalContacts();
  // const {startLiquidEventListener} = useLiquidEvent();
  const { toggleGlobalAppDataInformation } = useGlobalAppData();
  const [hasError, setHasError] = useState(null);
  const { t } = useTranslation();
  const [message, setMessage] = useState(
    t('screens.inAccount.loadingScreen.loadingMessage1'),
  );
  // const [didOpenDatabases, setDidOpenDatabases] = useState(false);

  // const didLoadInformation = useRef(false);

  // const liquidNodeConnectionRef = useRef(null);
  // const numberOfCachedTransactionsRef = useRef(null);
  // const didStartConnectionRef = useRef(null);

  const transformedAnimation = useMemo(() => {
    return updateMascatWalkingAnimation(
      mascotAnimation,
      theme ? 'white' : 'blue',
    );
  }, [theme]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setMessage(prevMessage =>
        prevMessage === t('screens.inAccount.loadingScreen.loadingMessage1')
          ? t('screens.inAccount.loadingScreen.loadingMessage2')
          : t('screens.inAccount.loadingScreen.loadingMessage1'),
      );
    }, 5000);

    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setTimeout(() => connectToSparkWallet(), 500);
  }, []);

  useEffect(() => {
    async function startConnectProcess() {
      try {
        crashlyticsLogReport(
          'Begining app connnection procress in loading screen',
        );
        console.log('Process 1', new Date().getTime());

        // connectToLiquidNode(accountMnemoinc);
        const [
          // didOpen,
          // giftCardTable,
          // posTransactions,
          // sparkTxs,
          // rootstockSwaps,
          didLoadUserSettings,
        ] = await Promise.all([
          // initializeDatabase(),
          // initializeGiftCardDatabase(),
          // initializePOSTransactionsDatabase(),
          // initializeSparkDatabase(),
          // initRootstockSwapDB(),
          initializeUserSettingsFromHistory({
            accountMnemoinc,
            setContactsPrivateKey: toggleContactsPrivateKey,
            setMasterInfoObject,
            toggleGlobalContactsInformation,
            // toggleGLobalEcashInformation,
            toggleGlobalAppDataInformation,
            toggleMasterInfoObject,
            preloadedData: preloadedUserData.data,
            setPreLoadedUserData,
          }),
        ]);
        createSigner();
        // console.log(
        //   didOpen,
        //   giftCardTable,
        //   posTransactions,
        //   sparkTxs,
        //   rootstockSwaps,
        //   didLoadUserSettings,
        // );
        // DO tables need to open before these other processes???/
        // if (
        //   !didOpen ||
        //   !giftCardTable ||
        //   !posTransactions ||
        //   !sparkTxs ||
        //   !rootstockSwaps
        // )
        //   throw new Error(t('screens.inAccount.loadingScreen.dbInitError'));
        // requestAnimationFrame(() => {
        //   requestAnimationFrame(() => {
        //     createSigner();
        //   });
        // });
        console.log('Process 2', new Date().getTime());
        crashlyticsLogReport('Opened all SQL lite tables');
        // const [
        //   // didConnectToLiquidNode,
        //   txs,
        //   // didLoadUserSettings,
        //   // signerResponse,
        // ] = await Promise.all([
        //   // connectToLiquidNode(accountMnemoinc),
        //   getCachedSparkTransactions(),
        //   // initializeUserSettingsFromHistory({
        //   //   accountMnemoinc,
        //   //   setContactsPrivateKey: toggleContactsPrivateKey,
        //   //   setMasterInfoObject,
        //   //   toggleGlobalContactsInformation,
        //   //   // toggleGLobalEcashInformation,
        //   //   toggleGlobalAppDataInformation,
        //   //   toggleMasterInfoObject,
        //   // }),
        //   // createSigner(),
        // ]);

        // liquidNodeConnectionRef.current = didConnectToLiquidNode;
        // numberOfCachedTransactionsRef.current = txs;

        if (!didLoadUserSettings)
          throw new Error(
            t('screens.inAccount.loadingScreen.userSettingsError'),
          );
        crashlyticsLogReport('Loaded users settings from firebase');
        // claimUnclaimedBoltzSwaps();
        // setDidOpenDatabases(true);
        console.log('Process 3', new Date().getTime());
        replace('HomeAdmin', { screen: 'Home' });
      } catch (err) {
        console.log('intializatiion error', err);
        setHasError(err.message);
      }
    }
    if (preloadedUserData.isLoading && !preloadedUserData.data) return;

    // setTimeout(() => {
    startConnectProcess();
    // }, 150);
  }, [preloadedUserData]);

  // useEffect(() => {
  //   if (
  //     Object.keys(masterInfoObject).length === 0 ||
  //     didLoadInformation.current ||
  //     Object.keys(globalContactsInformation).length === 0 ||
  //     !didOpenDatabases
  //   )
  //     return;
  //   didLoadInformation.current = true;
  //   crashlyticsLogReport('Initializing wallet settings');

  //   console.log('Process 4', new Date().getTime());
  //   initWallet();
  //   // liquidNodeConnectionRef.current,
  //   // numberOfCachedTransactionsRef.current,
  // }, [masterInfoObject, globalContactsInformation, didOpenDatabases]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={styles.globalContainer}>
        {hasError && (
          <TouchableOpacity
            onPress={() =>
              navigate.navigate('SettingsHome', { isDoomsday: true })
            }
            style={styles.doomsday}
          >
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
      </View>
    </GlobalThemeView>
  );

  // async function initWallet(didConnectToLiquidNode, txs) {
  //   console.log('HOME RENDER BREEZ EVENT FIRST LOAD');

  //   try {
  //     console.log('Process 5', new Date().getTime());
  //     crashlyticsLogReport('Trying to connect to nodes');
  //     // setNumberOfCachedTxs(txs?.length || 0);
  //     // if (didConnectToLiquidNode.isConnected) {
  //     crashlyticsLogReport('Loading node balances for session');
  //     console.log('Process 6', new Date().getTime());

  //     // requestAnimationFrame(() => {
  //     // requestAnimationFrame(() => {
  //     console.log('Process 21', new Date().getTime());
  //     replace('HomeAdmin', { screen: 'Home' });
  //     // });
  //     // });

  //     return;
  //     // const didSetLiquid = await setLiquidNodeInformationForSession();

  //     // console.log('Process 19', new Date().getTime());
  //     // if (didSetLiquid) {
  //     //   console.log('Process 20', new Date().getTime());
  //     //   // navigate.preload('HomeAdmin');
  //     //   requestAnimationFrame(() => {
  //     //     requestAnimationFrame(() => {
  //     //       console.log('Process 21', new Date().getTime());
  //     //       replace('HomeAdmin', { screen: 'Home' });
  //     //     });
  //     //   });
  //     // } else
  //     //   throw new Error(t('screens.inAccount.loadingScreen.liquidWalletError'));
  //     // // } else {
  //     // //   throw new Error(
  //     // //     t('screens.inAccount.loadingScreen.liquidWalletError2'),
  //     // //   );
  //     // // }
  //   } catch (err) {
  //     setHasError(String(err.message));
  //     crashlyticsLogReport(err.message);
  //     console.log(err, 'homepage connection to node err');
  //   }
  // }

  // async function setupFiatCurrencies() {
  //   console.log('Process 8', new Date().getTime());

  //   const currency = masterInfoObject.fiatCurrency;

  //   let fiatRate;
  //   try {
  //     fiatRate = await loadNewFiatData(
  //       currency,
  //       contactsPrivateKey,
  //       publicKey,
  //       masterInfoObject,
  //     );

  //     if (!fiatRate.didWork) {
  //       // fallback API
  //       const response = await fetch(process.env.FALLBACK_FIAT_PRICE_DATA);
  //       const data = await response.json();
  //       if (data[currency]?.['15m']) {
  //         // ✅ 4. Store in new format
  //         setLocalStorageItem(
  //           'didFetchFiatRateToday',
  //           JSON.stringify({
  //             lastFetched: new Date().getTime(),
  //             fiatRate: {
  //               coin: currency,
  //               value: data[currency]?.['15m'],
  //             },
  //           }),
  //         );
  //         setLocalStorageItem(
  //           'cachedBitcoinPrice',
  //           JSON.stringify({
  //             coin: currency,
  //             value: data[currency]?.['15m'],
  //           }),
  //         );
  //         fiatRate = {
  //           coin: currency,
  //           value: data[currency]?.['15m'],
  //         };
  //       } else {
  //         fiatRate = {
  //           coin: currency,
  //           value: 100_000, // random number to make sure nothing else down the line errors out
  //         };
  //       }
  //     } else fiatRate = fiatRate.fiatRateResponse;
  //   } catch (error) {
  //     console.error('Failed to fetch fiat data:', error);
  //     return { coin: 'USD', value: 100_000 };
  //   }

  //   console.log('Process 11', new Date().getTime());

  //   console.log('Process 12', new Date().getTime());

  //   return fiatRate;
  // }

  // async function setLiquidNodeInformationForSession() {
  //   try {
  //     // crashlyticsLogReport('Starting liquid node lookup process');
  //     // console.log('Process 7', new Date().getTime());
  //     // const [fiat_rate] = await Promise.all([setupFiatCurrencies()]);

  //     // console.log('Process 16', new Date().getTime());
  //     // // startLiquidEventListener(3);

  //     // console.log('Process 17', new Date().getTime());
  //     // console.log(fiat_rate, 'hty');

  //     // console.log('Process 18', new Date().getTime());
  //     // toggleFiatStats(fiat_rate);

  //     // toggleLiquidNodeInformation({
  //     //   didConnectToNode: true,
  //     // });

  //     return true;
  //   } catch (err) {
  //     console.log(err, 'LIQUID INFORMATION ERROR');
  //     return new Promise(resolve => {
  //       resolve(false);
  //     });
  //   }
  // }
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
