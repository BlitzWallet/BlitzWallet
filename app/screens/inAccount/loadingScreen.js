import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {COLORS, ICONS} from '../../constants';
import {useGlobalContextProvider} from '../../../context-store/context';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import initializeUserSettingsFromHistory from '../../functions/initializeUserSettings';
import claimUnclaimedBoltzSwaps from '../../functions/boltz/claimUnclaimedTxs';
import {useGlobalContacts} from '../../../context-store/globalContacts';
import {isMoreThanADayOld} from '../../functions/rotateAddressDateChecker';
import {useGlobalAppData} from '../../../context-store/appData';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import LottieView from 'lottie-react-native';
import {useNavigation} from '@react-navigation/native';
import ThemeImage from '../../functions/CustomElements/themeImage';
import {
  fetchFiatRates,
  listFiatCurrencies,
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
  const {toggleGlobalAppDataInformation} = useGlobalAppData();
  const [hasError, setHasError] = useState(null);
  const {t} = useTranslation();
  const [message, setMessage] = useState(
    t('screens.inAccount.loadingScreen.loadingMessage1'),
  );
  const [didOpenDatabases, setDidOpenDatabases] = useState(false);

  const didLoadInformation = useRef(false);

  const liquidNodeConnectionRef = useRef(null);
  const numberOfCachedTransactionsRef = useRef(null);
  const didStartConnectionRef = useRef(null);

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
    async function startConnectProcess() {
      try {
        crashlyticsLogReport(
          'Begining app connnection procress in loading screen',
        );
        console.log('Process 1', new Date().getTime());
        connectToSparkWallet();
        const [
          didOpen,
          // ecashTablesOpened,
          posTransactions,
          sparkTxs,
          rootstockSwaps,
        ] = await Promise.all([
          initializeDatabase(),
          // initEcashDBTables(),
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
          throw new Error(t('screens.inAccount.loadingScreen.dbInitError'));

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
          throw new Error(
            t('screens.inAccount.loadingScreen.userSettingsError'),
          );
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

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={styles.globalContainer}>
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
      </View>
    </GlobalThemeView>
  );

  async function initWallet(didConnectToLiquidNode, txs) {
    console.log('HOME RENDER BREEZ EVENT FIRST LOAD');

    try {
      console.log('Process 5', new Date().getTime());
      crashlyticsLogReport('Trying to connect to nodes');
      setNumberOfCachedTxs(txs?.length || 0);
      if (didConnectToLiquidNode.isConnected) {
        crashlyticsLogReport('Loading node balances for session');
        console.log('Process 6', new Date().getTime());
        const didSetLiquid = await setLiquidNodeInformationForSession();

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
            t('screens.inAccount.loadingScreen.liquidWalletError'),
          );
      } else {
        throw new Error(
          t('screens.inAccount.loadingScreen.liquidWalletError2'),
        );
      }
    } catch (err) {
      setHasError(String(err.message));
      crashlyticsLogReport(err.message);
      console.log(err, 'homepage connection to node err');
    }
  }

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

  async function setLiquidNodeInformationForSession() {
    try {
      crashlyticsLogReport('Starting liquid node lookup process');
      console.log('Process 7', new Date().getTime());
      const [fiat_rate] = await Promise.all([setupFiatCurrencies()]);

      console.log('Process 16', new Date().getTime());
      startLiquidEventListener(3);

      console.log('Process 17', new Date().getTime());
      console.log(fiat_rate, 'hty');

      console.log('Process 18', new Date().getTime());
      toggleFiatStats(fiat_rate);

      toggleLiquidNodeInformation({
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
