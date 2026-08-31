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
import {
  StackActions,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { navigationRef } from '../../../navigation/navigationService';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useKeysContext } from '../../../context-store/keys';
import { getMascatWalkingAnimation } from '../../functions/lottieAnimations';
import {
  crashlyticsLogReport,
  crashlyticsRecordErrorReport,
} from '../../functions/crashlyticsLogs';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { removeLocalStorageItem } from '../../functions/localStorage';
import { getAccountBalanceSnapshot } from '../../functions/spark/balanceSnapshots';
import { privateKeyFromSeedWords } from '../../functions/nostrCompatability';
import { getPublicKey } from 'nostr-tools';
import { useWebView } from '../../../context-store/webViewContext';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { getCachedSparkTransactions } from '../../functions/spark';
import { deriveSparkIdentityKey } from '../../functions/gift/deriveGiftWallet';
import sha256Hash from '../../functions/hash';
import { useAppStatus } from '../../../context-store/appStatus';
import { initializeAllDatabases } from '../../functions/initializeAllDatabases';
import openWebBrowser from '../../functions/openWebBrowser';
import NoContentScreen from '../../functions/CustomElements/noContentScreen';
import { useNodeContext } from '../../../context-store/nodeContext';
import { getCachedFiatRate } from '../../functions/saveAndUpdateFiatData';
import wipeLocalWalletData from '../../functions/wipeLocalWalletData';
import { isWipeInProgress } from '../../functions/secureStore';
import i18next from 'i18next';

export default function ConnectingToNodeLoadingScreen() {
  const navigate = useNavigation();
  const route = useRoute();
  // Hash of the exact seed the caller intends this account to load. Threaded in
  // from every entry point (create/restore via pin.js, relogin via pin/biometric,
  // no-security via App.tsx initialParams). We refuse to derive the account
  // identity until the in-context accountMnemoinc hashes to this value — see the
  // gate in the connect effect below.
  const expectedMnemonicHash = route.params?.expectedMnemonicHash;
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
  const { screenDimensions, toggleDidGetToHomepage } = useAppStatus();
  const { toggleFiatStats } = useNodeContext();
  const [hasError, setHasError] = useState(null);
  const { t } = useTranslation();
  const didRunConnectionRef = useRef(null);
  // Latched once startConnectProcess has fully settled (navigated, or errored
  // into the recoverable UI). The watchdog below keys off this, NOT off
  // didRunConnectionRef — see the comment there.
  const didCompleteRef = useRef(false);
  // Last boundary startConnectProcess got past. Reported with the watchdog error
  // so a stall in the wild names its own phase in Crashlytics.
  const phaseRef = useRef('mounted');

  // Latched by the watchdog below. Blocks the navigation dispatch only — a login
  // that resumes after the watchdog fired still applies its cached state (keys,
  // balance, fiat rate), which is what makes the doomsday settings screen useful.
  const didAbortLogin = useRef(false);

  const transformedAnimation = getMascatWalkingAnimation(theme);

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

        // Onboarding (create/restore) routes here with shouldWipeLocalData so a
        // previous wallet's stale AsyncStorage + SQLite can't render as the new
        // wallet's live data. Runs first, before any init/cache reads, and only
        // after the seed gate below has committed the correct seed. A failure
        // throws into the catch (recoverable error UI) and a hang is caught by
        // the 45s watchdog — neither was possible on the PIN page. isWipeInProgress
        // re-arms a wipe that failed or was killed mid-run on a previous launch:
        // wipeLocalWalletData leaves a keychain marker until it fully succeeds,
        // and route params are gone after a restart, so without it the partially
        // wiped previous wallet would proceed into the new account.
        const wipeArmed = await isWipeInProgress();
        if (route.params?.shouldWipeLocalData || wipeArmed) {
          if (wipeArmed) {
            crashlyticsLogReport(
              'Re-running wipe: marker armed from a previous failed wipe',
            );
          }
          phaseRef.current = 'wiping previous wallet local data';
          crashlyticsLogReport('Wiping previous wallet local data before init');
          // Best attempt a wipe, do not block login this is cosmetic and an edge case issue
          await wipeLocalWalletData();

          // Small settle so re-created DB handles / dropped tables quiesce
          // before the parallel init + cache reads below touch them.
          await new Promise(res => setTimeout(res, 1000));
        }

        phaseRef.current = 'deriving keys + webview handshake + db init';
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

        crashlyticsLogReport('Derived keys, webview handshake and db ready');
        phaseRef.current = 'loading user settings + cached balance/txs';

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
              ? Promise.resolve({ didWork: true })
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
          if (!didLoadUserSettings.didWork)
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
        crashlyticsLogReport('Loaded user settings and cached balance/txs');
        phaseRef.current = 'applying cached state + navigating home';

        // ── Phase 3: Apply cached balance ─────────────────────────────────
        setSparkInformation(prev => ({
          ...prev,
          transactions: placeholderTxs,
          ...(balanceSnapshot ?? {}),
        }));

        // Seed the fiat rate from cache so Home paints with a real rate
        // instead of the placeholder while nodeContext fetches a fresh one.
        const currency =
          masterInfoObject?.fiatCurrency ||
          didLoadUserSettings?.response?.fiatCurrency ||
          'USD';
        const cachedRate = await getCachedFiatRate(currency);
        if (cachedRate?.fiatRate) toggleFiatStats(cachedRate.fiatRate);

        // ── Phase 4: Minimum perceived loading time then navigate ─────────
        const elapsed = Date.now() - startTime;
        const minDuration = 1500;
        await new Promise(resolve =>
          setTimeout(resolve, Math.round(minDuration - elapsed)),
        );

        if (didAbortLogin.current) return;
        toggleDidGetToHomepage(true);
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
      } finally {
        // Settled either way (navigated, bailed as a stale duplicate, or errored
        // into the recoverable UI) — disarm the watchdog.
        didCompleteRef.current = true;
      }
    }

    if (didRunConnectionRef.current) return;
    if (preloadedUserData.isLoading && !preloadedUserData.data) return;

    // ── Seed gate ─────────────────────────────────────────────────────────
    // The account identity (UUID + spark identity) is derived from
    // accountMnemoinc below. Under the restore/login navigation race this
    // effect can run while accountMnemoinc is still empty/stale — deriving the
    // identity from the wrong seed while the wallet connects with the correct
    // one (real funds, wrong account). Latch the derivation only once the
    // in-context seed is exactly the seed the caller intended. We do NOT set
    // didRunConnectionRef here, so the effect re-runs (accountMnemoinc is a dep)
    // and latches the instant the seed converges.
    if (!accountMnemoinc) return;
    if (expectedMnemonicHash) {
      if (sha256Hash(accountMnemoinc) !== expectedMnemonicHash) return;
    }

    didRunConnectionRef.current = true;

    requestAnimationFrame(startConnectProcess);
  }, [
    preloadedUserData,
    masterInfoObject,
    accountMnemoinc,
    expectedMnemonicHash,
  ]);

  // Safety valve for the WHOLE login process, not just the seed gate.
  //
  // This previously keyed off didRunConnectionRef, which is set the instant
  // startConnectProcess is scheduled — so the only timeout in the login flow was
  // switched off at exactly the moment the risky work began. Everything after it
  // (firebase auth, firestore reads/writes, the NWC spark wallet init) is network
  // bound and can stay pending forever without ever rejecting, which no try/catch
  // can see. That produced the reported symptom: an endless mascot animation with
  // no error and no way out.
  //
  // Keying off didCompleteRef instead means no reachable path can spin forever —
  // any stall lands on the recoverable error UI below, which carries the doomsday
  // settings button and the recovery link. Deps are empty (t is read through a
  // ref) so an i18n language change can't restart the timer.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (didCompleteRef.current) return;
      didAbortLogin.current = true;
      crashlyticsRecordErrorReport(
        `Login watchdog fired after 45s. Last phase reached: ${phaseRef.current}`,
      );
      setHasError({
        title: i18next.t('screens.inAccount.loadingScreen.initErrorTitle'),
        subtitle: i18next.t(
          'screens.inAccount.loadingScreen.userSettingsError',
        ),
      });
    }, 45000);
    return () => clearTimeout(timer);
  }, []);

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
