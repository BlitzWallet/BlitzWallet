import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS, PERSISTED_LOGIN_COUNT_KEY } from '../../constants';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import initializeUserSettingsFromHistory from '../../functions/initializeUserSettings';
import { useGlobalContacts } from '../../../context-store/globalContacts';
import { useGlobalAppData } from '../../../context-store/appData';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import LottieView from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useKeysContext } from '../../../context-store/keys';
import { updateMascatWalkingAnimation } from '../../functions/lottieViewColorTransformer';
import { crashlyticsLogReport } from '../../functions/crashlyticsLogs';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { removeLocalStorageItem } from '../../functions/localStorage';
import { privateKeyFromSeedWords } from '../../functions/nostrCompatability';
import { getPublicKey } from 'nostr-tools';
import { useWebView } from '../../../context-store/webViewContext';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { getCachedSparkTransactions } from '../../functions/spark';
import { SparkReadonlyClient } from '@buildonspark/spark-sdk';
import {
  deriveSparkAddress,
  deriveSparkIdentityKey,
} from '../../functions/gift/deriveGiftWallet';
import { useAppStatus } from '../../../context-store/appStatus';

const mascotAnimation = require('../../assets/MOSCATWALKING.json');

export default function ConnectingToNodeLoadingScreen({
  navigation: { replace },
}) {
  const navigate = useNavigation();
  const {
    toggleMasterInfoObject,
    masterInfoObject,
    setMasterInfoObject,
    preloadedUserData,
    setPreLoadedUserData,
  } = useGlobalContextProvider();
  const { didRunHandshakeRef } = useWebView();
  const { connectToSparkWallet, setSparkInformation } = useSparkWallet();
  const { toggleContactsPrivateKey, accountMnemoinc } = useKeysContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { toggleGlobalContactsInformation, globalContactsInformation } =
    useGlobalContacts();
  const { toggleGlobalAppDataInformation } = useGlobalAppData();
  const { screenDimensions } = useAppStatus();
  const [hasError, setHasError] = useState(null);
  const { t } = useTranslation();
  const [message, setMessage] = useState(
    t('screens.inAccount.loadingScreen.loadingMessage1'),
  );
  const didRunConnectionRef = useRef(null);

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

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    async function startConnectProcess() {
      const startTime = Date.now();

      try {
        crashlyticsLogReport(
          'Begining app connnection procress in loading screen',
        );
        removeLocalStorageItem(PERSISTED_LOGIN_COUNT_KEY);
        console.log('Process 1', new Date().getTime());

        const [privateKey, identityPubKey] = await Promise.all([
          privateKeyFromSeedWords(accountMnemoinc),
          deriveSparkIdentityKey(accountMnemoinc),
        ]);

        const sparkAddress = deriveSparkAddress(identityPubKey.publicKey);
        const publicKey = privateKey ? getPublicKey(privateKey) : null;

        if (!privateKey || !publicKey)
          throw new Error(
            t('screens.inAccount.loadingScreen.userSettingsError'),
          );

        const READONLY_TIMEOUT_MS = 6000;
        const readonlyFetchPromise = Promise.race([
          (async () => {
            try {
              const client = await SparkReadonlyClient.createWithMasterKey(
                { network: 'MAINNET' },
                accountMnemoinc,
              );
              const [balance, tokenMap] = await Promise.all([
                client.getAvailableBalance(sparkAddress.address),
                client.getTokenBalance(sparkAddress.address),
              ]);

              const tokens = {};
              for (const [tokenId, info] of tokenMap) {
                tokens[tokenId] = {
                  balance: info.availableToSendBalance,
                  tokenMetadata: info.tokenMetadata,
                };
              }

              return { initialBalance: Number(balance), tokens };
            } catch (err) {
              console.log('Readonly balance fetch failed (non-fatal):', err);
              return { initialBalance: 0, tokens: {} };
            }
          })(),
          new Promise(resolve =>
            setTimeout(() => {
              console.log(
                'Readonly balance fetch timed out — proceeding with defaults',
              );
              resolve({ initialBalance: 0, tokens: {} });
            }, READONLY_TIMEOUT_MS),
          ),
        ]);

        const placeholderTxsPromise = getCachedSparkTransactions(
          20,
          identityPubKey.publicKeyHex,
        );

        if (!didRunHandshakeRef.current) {
          console.warn('Webview has not finished setting up: wait here');
          const MAX_RUNS = 10;
          let currentRun = 0;
          while (!didRunHandshakeRef.current && currentRun < MAX_RUNS) {
            console.log(
              'Waiting for webview to finish. Retry number:',
              currentRun,
            );
            currentRun += 1;
            await new Promise(res => setTimeout(res, 1000));
          }
        }
        connectToSparkWallet();

        const [placeholderTxs, { initialBalance, tokens }] = await Promise.all([
          placeholderTxsPromise,
          readonlyFetchPromise,
        ]);

        const hasSavedInfo = Object.keys(masterInfoObject || {}).length > 5;

        if (!hasSavedInfo) {
          const [didLoadUserSettings] = await Promise.all([
            initializeUserSettingsFromHistory({
              setMasterInfoObject,
              toggleGlobalContactsInformation,
              toggleGlobalAppDataInformation,
              toggleMasterInfoObject,
              preloadedData: preloadedUserData.data,
              setPreLoadedUserData,
              privateKey,
              publicKey,
            }),
          ]);

          crashlyticsLogReport('Opened all SQL lite tables');

          if (!didLoadUserSettings)
            throw new Error(
              t('screens.inAccount.loadingScreen.userSettingsError'),
            );
          crashlyticsLogReport('Loaded users settings from firebase');
        }
        toggleContactsPrivateKey(privateKey);
        setSparkInformation(prev => ({
          ...prev,
          transactions: placeholderTxs,
          balance: initialBalance,
          tokens,
        }));
        console.log('Process 3', new Date().getTime());

        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(
          0,
          (hasSavedInfo ? 500 : 1500) - elapsedTime,
        );

        if (remainingTime > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingTime));
        } else {
          await new Promise(resolve => setTimeout(resolve, 60));
        }

        replace('HomeAdmin', { screen: 'Home' });
      } catch (err) {
        console.log('intializatiion error', err);
        setHasError(err.message);
      }
    }
    if (preloadedUserData.isLoading && !preloadedUserData.data) return;
    if (didRunConnectionRef.current) return;
    didRunConnectionRef.current = true;

    requestAnimationFrame(startConnectProcess);
  }, [preloadedUserData, masterInfoObject]);

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
            <ThemeIcon iconName={'Settings'} />
          </TouchableOpacity>
        )}
        <LottieView
          source={transformedAnimation}
          autoPlay
          loop={true}
          style={{
            width: Math.max(screenDimensions.width * 0.5, 450),
            height: Math.max(screenDimensions.width * 0.5, 450),
          }}
        />

        {hasError && (
          <ThemeText
            styles={{
              ...styles.waitingText,
              color: theme ? COLORS.darkModeText : COLORS.primary,
            }}
            content={hasError ? hasError : message}
          />
        )}
      </View>
    </GlobalThemeView>
  );
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
