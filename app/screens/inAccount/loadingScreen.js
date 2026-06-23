import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { PERSISTED_LOGIN_COUNT_KEY } from '../../constants';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import initializeUserSettingsFromHistory from '../../functions/initializeUserSettings';
import { useGlobalContactsInfo } from '../../../context-store/globalContacts';
import { useGlobalAppData } from '../../../context-store/appData';
import { GlobalThemeView } from '../../functions/CustomElements';
import LottieView from 'lottie-react-native';
import { StackActions, useNavigation } from '@react-navigation/native';
import { navigationRef } from '../../../navigation/navigationService';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useKeysContext } from '../../../context-store/keys';
import { updateMascatWalkingAnimation } from '../../functions/lottieViewColorTransformer';
import { crashlyticsLogReport } from '../../functions/crashlyticsLogs';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { removeLocalStorageItem } from '../../functions/localStorage';
import { getAccountBalanceSnapshot } from '../../functions/spark/balanceSnapshots';
import { privateKeyFromSeedWords } from '../../functions/nostrCompatability';
import { getPublicKey } from 'nostr-tools';
import { useWebView } from '../../../context-store/webViewContext';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { getCachedSparkTransactions } from '../../functions/spark';
import { deriveSparkIdentityKey } from '../../functions/gift/deriveGiftWallet';
import { useAppStatus } from '../../../context-store/appStatus';
import { initializeAllDatabases } from '../../functions/initializeAllDatabases';
import openWebBrowser from '../../functions/openWebBrowser';
import NoContentScreen from '../../functions/CustomElements/noContentScreen';

const mascotAnimation = require('../../assets/MOSCATWALKING.json');

export default function ConnectingToNodeLoadingScreen() {
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
  const { theme } = useGlobalThemeContext();
  const { toggleGlobalContactsInformation } = useGlobalContactsInfo();
  const { toggleGlobalAppDataInformation } = useGlobalAppData();
  const { screenDimensions } = useAppStatus();
  const [hasError, setHasError] = useState(null);
  const { t } = useTranslation();
  const didRunConnectionRef = useRef(null);

  const transformedAnimation = useMemo(
    () =>
      updateMascatWalkingAnimation(mascotAnimation, theme ? 'white' : 'blue'),
    [theme],
  );

  useEffect(() => {
    async function startConnectProcess() {
      const startTime = Date.now();

      try {
        // A duplicate loading-screen instance can mount during the
        // restore/login navigation race. If the app has already reached the
        // home stack, this instance is stale — bail before re-running connect.
        if (navigationRef.getCurrentRoute()?.name === 'HomeAdmin') return;
        crashlyticsLogReport(
          'Begining app connnection procress in loading screen',
        );
        removeLocalStorageItem(PERSISTED_LOGIN_COUNT_KEY);

        // ── Phase 1: Derive keys + wait for webview handshake in parallel ──
        const waitForHandshake = async () => {
          if (didRunHandshakeRef.current) return;
          console.warn('Webview has not finished setting up: wait here');
          for (let i = 0; i < 10; i++) {
            if (didRunHandshakeRef.current) break;
            console.log('Waiting for webview to finish. Retry number:', i);
            await new Promise(res => setTimeout(res, 1000));
          }
        };

        // initializeAllDatabases is awaited here (it's fired non-blocking from
        // the splash screen) so every local table exists before connecting or
        // reading cached data. Runs in parallel with key derivation/handshake.
        const [[privateKey, identityPubKey]] = await Promise.all([
          Promise.all([
            privateKeyFromSeedWords(accountMnemoinc),
            deriveSparkIdentityKey(accountMnemoinc),
          ]),
          waitForHandshake(),
          initializeAllDatabases(),
        ]);

        // Start wallet connection after keys are derived — passes identityPubKey
        // so initializeSparkSession can skip getSparkBalance when snapshot exists
        connectToSparkWallet(identityPubKey.publicKeyHex);

        const publicKey = privateKey ? getPublicKey(privateKey) : null;
        if (!privateKey || !publicKey)
          throw new Error(
            t('screens.inAccount.loadingScreen.userSettingsError'),
          );

        const hasSavedInfo = Object.keys(masterInfoObject || {}).length > 5;

        // ── Phase 2: Cache reads + settings init all in parallel ──────────
        const [placeholderTxs, balanceSnapshot, didLoadUserSettings] =
          await Promise.all([
            getCachedSparkTransactions(20, identityPubKey.publicKeyHex),
            getAccountBalanceSnapshot(identityPubKey.publicKeyHex),
            hasSavedInfo
              ? Promise.resolve(true)
              : initializeUserSettingsFromHistory({
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

        if (!hasSavedInfo) {
          crashlyticsLogReport('Opened all SQL lite tables');
          if (!didLoadUserSettings)
            throw new Error(
              t('screens.inAccount.loadingScreen.userSettingsError'),
            );
          crashlyticsLogReport('Loaded users settings from firebase');
        }

        // causes error in firebase let acync wait
        //https://github.com/firebase/firebase-ios-sdk/issues/15974#issuecomment-4155423268
        //https://github.com/firebase/firebase-ios-sdk/pull/15991
        toggleContactsPrivateKey(privateKey);
        console.log(balanceSnapshot, placeholderTxs, 'balance and tx snapshot');

        // ── Phase 3: Apply cached balance ─────────────────────────────────
        setSparkInformation(prev => ({
          ...prev,
          transactions: placeholderTxs,
          ...(balanceSnapshot ?? {}),
        }));

        // ── Phase 4: Minimum perceived loading time then navigate ─────────
        const elapsed = Date.now() - startTime;
        const minDuration = hasSavedInfo ? 500 : 1500;
        await new Promise(resolve =>
          setTimeout(resolve, Math.max(60, minDuration - elapsed)),
        );

        // Idempotent + dispatched through the container (not this instance's
        // possibly-stale navigation prop): if a duplicate instance already
        // moved us to HomeAdmin, skip — re-committing the screen is what throws
        // "No view found for id … for fragment ScreenFragment" on Android.
        if (
          navigationRef.isReady() &&
          navigationRef.getCurrentRoute()?.name !== 'HomeAdmin'
        ) {
          navigationRef.dispatch(
            StackActions.replace('HomeAdmin', { screen: 'Home' }),
          );
        }
      } catch (err) {
        console.log('intializatiion error', err);
        if (err.message === 'dbInitError') {
          setHasError({
            title: t('screens.inAccount.loadingScreen.dbInitError1'),
            subtitle: t('screens.inAccount.loadingScreen.dbInitError2'),
          });
        } else {
          setHasError({
            title: t('screens.inAccount.loadingScreen.initErrorTitle'),
            subtitle: err.message,
          });
        }
      }
    }

    if (preloadedUserData.isLoading && !preloadedUserData.data) return;
    if (!accountMnemoinc) return;
    if (didRunConnectionRef.current) return;
    didRunConnectionRef.current = true;

    requestAnimationFrame(startConnectProcess);
  }, [preloadedUserData, masterInfoObject, accountMnemoinc]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={styles.globalContainer}>
        {hasError ? (
          <>
            <TouchableOpacity
              onPress={() =>
                navigate.navigate('SettingsHome', { isDoomsday: true })
              }
              style={styles.doomsday}
            >
              <ThemeIcon iconName={'Settings'} />
            </TouchableOpacity>
            <NoContentScreen
              iconName="TriangleAlert"
              titleText={hasError.title}
              subTitleText={hasError.subtitle}
              showButton={true}
              buttonText={t('constants.recover')}
              buttonFunction={() =>
                openWebBrowser({
                  navigate,
                  link: 'https://recover.blitzwalletapp.com/',
                })
              }
            />
          </>
        ) : (
          <LottieView
            source={transformedAnimation}
            autoPlay
            loop={true}
            style={{
              width: Math.min(screenDimensions.width * 0.4, 400),
              height: Math.min(screenDimensions.width * 0.4, 400),
            }}
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
  doomsday: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
