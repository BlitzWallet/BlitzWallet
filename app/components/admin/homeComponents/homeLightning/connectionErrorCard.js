import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { openComposer } from 'react-native-email-link';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useKeysContext } from '../../../../../context-store/keys';
import { useToast } from '../../../../../context-store/toastManager';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { useTheme } from '../../../../../context-store/theme';
import { initWallet } from '../../../../functions/initiateWalletConnection';
import { copyToClipboard } from '../../../../functions';
import { touchAccountBalanceSnapshot } from '../../../../functions/spark/balanceSnapshots';
import CustomButton from '../../../../functions/CustomElements/button';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import HomeCard from './homeCard';

const SUPPORT_EMAIL = 'support@blitzwalletapp.com';

// Today shows the time alone, older adds the date.
function formatLastConnected(timestamp) {
  const date = new Date(timestamp);
  const time = { hour: 'numeric', minute: '2-digit' };
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], time)
    : date.toLocaleString([], { month: 'short', day: 'numeric', ...time });
}

// Retry reconnects; after one failed retry the pill reports the error (same
// two steps as SparkErrorScreen). The last connected time lives on the wallet's
// balance snapshot, so a failure right at launch can say how old the balance is.
export default function ConnectionErrorCard({ visible }) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { tokens } = useTheme();
  const { showToast } = useToast();
  const { accountMnemoinc } = useKeysContext();
  const { isConnectedToTheInternet } = useAppStatus();
  const {
    sparkInformation,
    sparkConnectionError,
    setSparkInformation,
    filterAndSetTransactions,
  } = useSparkWallet();
  const [isRetrying, setIsRetrying] = useState(false);
  const [didRetryFail, setDidRetryFail] = useState(false);
  const [connectedAt, setConnectedAt] = useState(null);
  const lastConnectedAt = connectedAt ?? sparkInformation.balanceUpdatedAt;

  // A later failure starts over at Retry.
  useEffect(() => {
    if (!visible) setDidRetryFail(false);
  }, [visible]);

  useEffect(() => {
    if (!sparkInformation.identityPubKey) return;
    if (!sparkInformation.didConnect || !isConnectedToTheInternet) return;
    setConnectedAt(Date.now());
    touchAccountBalanceSnapshot(sparkInformation.identityPubKey);
  }, [
    sparkInformation.identityPubKey,
    sparkInformation.didConnect,
    sparkInformation.balance,
    isConnectedToTheInternet,
  ]);

  const handleRetry = async () => {
    if (!isConnectedToTheInternet) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('errormessages.nointernet'),
      });
      return;
    }
    if (didRetryFail) {
      try {
        await openComposer({
          to: SUPPORT_EMAIL,
          subject: 'Spark Wallet Error Report',
          body:
            sparkConnectionError ||
            'An error occurred while connecting to Spark Wallet.',
        });
      } catch (err) {
        copyToClipboard(SUPPORT_EMAIL, showToast);
      }
      return;
    }
    setIsRetrying(true);
    try {
      const { didWork } = await initWallet({
        setSparkInformation,
        filterAndSetTransactions,
        mnemonic: accountMnemoinc,
        hasRestoreCompleted: false,
      });
      // initWallet sets didConnect before its last step can fail.
      if (!didWork) {
        setSparkInformation(prev => ({ ...prev, didConnect: false }));
      }
      setDidRetryFail(!didWork);
    } catch (err) {
      console.log('home connection retry error', err);
      setDidRetryFail(true);
    } finally {
      setIsRetrying(false);
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
    >
      <HomeCard
        lead={<Disc icon={'WifiOff'} size={44} iconSize={20} tone="warm" />}
        title={t('wallet.homeLightning.home.connectionTitle')}
        sub={
          lastConnectedAt
            ? t('wallet.homeLightning.home.connectionSub', {
                time: formatLastConnected(lastConnectedAt),
              })
            : undefined
        }
        trailing={
          <CustomButton
            textContent={t(
              didRetryFail ? 'constants.reportError' : 'constants.retry',
            )}
            size={'small'}
            tone={'secondary'}
            useLoading={isRetrying}
            buttonStyles={{ backgroundColor: tokens.ground }}
            textStyles={styles.retryText}
            actionFunction={handleRetry}
          />
        }
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  retryText: { fontSize: 14, lineHeight: 20 },
});
