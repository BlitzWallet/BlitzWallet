import { StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  BALANCE_SNAPSHOT_KEY,
  COLORS,
  PERSISTED_LOGIN_COUNT_KEY,
} from '../../constants';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  getLocalStorageItem,
  removeLocalStorageItem,
} from '../../functions/localStorage';
import { privateKeyFromSeedWords } from '../../functions/nostrCompatability';
import { getPublicKey } from 'nostr-tools';
import { useWebView } from '../../../context-store/webViewContext';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { getCachedSparkTransactions } from '../../functions/spark';
import { deriveSparkIdentityKey } from '../../functions/gift/deriveGiftWallet';
import { useAppStatus } from '../../../context-store/appStatus';
import { decryptMessage } from '../../functions/messaging/encodingAndDecodingMessages';

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
  const { theme } = useGlobalThemeContext();
  const { toggleGlobalContactsInformation } = useGlobalContacts();
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
        crashlyticsLogReport(
          'Begining app connnection procress in loading screen',
        );
        removeLocalStorageItem(PERSISTED_LOGIN_COUNT_KEY);

        if (didRunHandshakeRef.current) {
          connectToSparkWallet();
        }

        // ── Phase 1: Derive keys + wait for webview handshake in parallel ──
        const waitForHandshake = async () => {
          if (didRunHandshakeRef.current) return;
          console.warn('Webview has not finished setting up: wait here');
          for (let i = 0; i < 10; i++) {
            if (didRunHandshakeRef.current) break;
            console.log('Waiting for webview to finish. Retry number:', i);
            await new Promise(res => setTimeout(res, 1000));
          }
          connectToSparkWallet();
        };

        const [[privateKey, identityPubKey]] = await Promise.all([
          Promise.all([
            privateKeyFromSeedWords(accountMnemoinc),
            deriveSparkIdentityKey(accountMnemoinc),
          ]),
          waitForHandshake(),
        ]);

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
            getLocalStorageItem(BALANCE_SNAPSHOT_KEY),
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

        toggleContactsPrivateKey(privateKey);

        console.log(balanceSnapshot, placeholderTxs);

        // ── Phase 3: Apply cached balance ─────────────────────────────────
        if (balanceSnapshot) {
          try {
            const balance = JSON.parse(
              decryptMessage(privateKey, publicKey, balanceSnapshot),
            );
            setSparkInformation(prev => ({
              ...prev,
              transactions: placeholderTxs,
              ...balance,
            }));
          } catch (err) {
            console.log('Error parsing cached balance', err);
            setSparkInformation(prev => ({
              ...prev,
              transactions: placeholderTxs,
            }));
          }
        } else {
          setSparkInformation(prev => ({
            ...prev,
            transactions: placeholderTxs,
          }));
        }

        // ── Phase 4: Minimum perceived loading time then navigate ─────────
        const elapsed = Date.now() - startTime;
        const minDuration = hasSavedInfo ? 500 : 1500;
        await new Promise(resolve =>
          setTimeout(resolve, Math.max(60, minDuration - elapsed)),
        );

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
            width: Math.min(screenDimensions.width * 0.4, 400),
            height: Math.min(screenDimensions.width * 0.4, 400),
          }}
        />
        {hasError && (
          <ThemeText
            styles={{
              ...styles.waitingText,
              color: theme ? COLORS.darkModeText : COLORS.primary,
            }}
            content={hasError}
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
