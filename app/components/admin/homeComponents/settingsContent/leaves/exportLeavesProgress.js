import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import DeviceInfo from 'react-native-device-info';
import writeAndShareFileToFilesystem from '../../../../../functions/writeFileToFilesystem';
import {
  getSparkLeaves,
  getSparkLeafExitNodes,
} from '../../../../../functions/spark';
import {
  replaceAllLeaves,
  getAllLeavesStream,
  normalizeLeaf,
} from '../../../../../functions/spark/leavesStorage';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';

// Maps the SDK Network enum int to the label the recovery tooling expects.
const NETWORK_LABELS = {
  1: 'MAINNET',
  2: 'REGTEST',
  3: 'TESTNET',
  4: 'SIGNET',
};

// Progress step -> user-facing translation key. Each step is flipped right
// before its (single, atomic) phase runs, so this is phase-level granularity.
const STEP_MESSAGES = {
  gathering: 'screens.inAccount.walletLeaves.progress.gathering',
  saving: 'screens.inAccount.walletLeaves.progress.saving',
  exit: 'screens.inAccount.walletLeaves.progress.exit',
  building: 'screens.inAccount.walletLeaves.progress.building',
  sharing: 'screens.inAccount.walletLeaves.progress.sharing',
};

// Runs the full leaf-export flow behind a half modal, surfacing a simple
// message per phase (see exportLeaves.js for the schema rationale). If the live
// getSparkLeaves snapshot fails, we fall back to the locally stored leaf set so
// the user can still export their last known copy. The half modal stays
// dismissible; if the user leaves mid-export, `mountedRef` suppresses the share
// sheet and any navigation.
export default function ExportLeavesProgress({ onExported }) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sparkInformation } = useSparkWallet();
  const [step, setStep] = useState('gathering');
  const mountedRef = useRef(true);
  const hasRunRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const finishWithError = errorMessage => {
      if (!mountedRef.current) return;
      navigate.goBack();
      setTimeout(() => {
        navigate.navigate('ErrorScreen', {
          errorMessage,
          useTranslationString: true,
        });
      }, 300);
    };

    (async () => {
      try {
        setStep('gathering');
        // Full, cross-operator, recovered snapshot — the trustworthy exit copy.
        const rawLeaves = await getSparkLeaves(currentWalletMnemoinc, false);
        if (!mountedRef.current) return;

        // getSparkLeaves returns undefined only when the fetch itself failed;
        // an empty array means the wallet genuinely has no leaves.
        const fetchFailed = rawLeaves == null;
        const hasFreshLeaves = Array.isArray(rawLeaves) && rawLeaves.length > 0;

        if (!fetchFailed && !hasFreshLeaves) {
          finishWithError('screens.inAccount.walletLeaves.noLeavesToExport');
          return;
        }

        // Only refresh the local store and fetch ancestor chains when we have a
        // fresh raw snapshot. On a failed fetch we fall back to whatever is
        // already stored locally.
        let nodeParts = [];
        if (hasFreshLeaves) {
          setStep('saving');
          await replaceAllLeaves(rawLeaves);
          if (onExported) onExported();
          if (!mountedRef.current) return;

          // Fetch each leaf's ancestor chain from Spark operators so multi-level
          // trees can be exited offline. Native runtime only; returns [] on the
          // WebView path or on failure, leaving a valid leaves-only bundle.
          setStep('exit');
          try {
            const exitNodes = await getSparkLeafExitNodes(
              currentWalletMnemoinc,
              rawLeaves,
            );
            for (const node of exitNodes) {
              const normalized = normalizeLeaf(node);
              if (normalized?.treeNodeHex) {
                nodeParts.push(JSON.stringify(normalized));
              }
            }
          } catch (err) {
            console.log('export exit nodes error', err);
          }
          if (!mountedRef.current) return;
        }
        const hasAncestors = nodeParts.length > 0;

        // Assemble the file from the stored leaves in yielding batches. Works
        // for both the fresh snapshot (just stored) and the local fallback.
        setStep('building');
        const parts = [];
        let btcSats = 0n;
        let networkInt = null;
        await getAllLeavesStream(batch => {
          for (const leaf of batch) {
            parts.push(JSON.stringify(leaf));
            btcSats += BigInt(leaf.value || 0);
            if (networkInt == null && leaf.network != null)
              networkInt = leaf.network;
          }
        });
        if (!mountedRef.current) return;

        if (parts.length === 0) {
          finishWithError('screens.inAccount.walletLeaves.noLeavesToExport');
          return;
        }

        const networkLabel = NETWORK_LABELS[networkInt] || 'MAINNET';
        const recoveryNotes = hasAncestors
          ? 'Includes each leaf plus its ancestor TreeNodes up to the tree root, ' +
            'captured from Spark operators at export time, so this bundle can ' +
            'drive an offline unilateral exit of multi-level trees. Refresh it ' +
            'after any wallet activity. See the spark-unilateral-exit guide.'
          : 'Leaves only. Ancestor/parent TreeNodes are not included; offline ' +
            'unilateral exit of multi-level trees needs live Spark operators or ' +
            'the reference Rust exporter (tools/spark-recovery-bundle). See the ' +
            'spark-unilateral-exit guide.';

        const fileData =
          `{"schema":"spark.unilateral-exit-bundle.v1",` +
          `"createdAt":${JSON.stringify(new Date().toISOString())},` +
          `"network":${JSON.stringify(networkLabel)},` +
          `"operatorSet":"spark-sdk",` +
          `"walletIdentityPublicKey":${JSON.stringify(
            sparkInformation.identityPubKey || '',
          )},` +
          `"sparkSdkVersion":"0.8.5",` +
          `"appVersion":${JSON.stringify(DeviceInfo.getVersion())},` +
          `"leafCount":${parts.length},` +
          `"leaves":[${parts.join(',')}],` +
          `"nodes":[${nodeParts.join(',')}],` +
          `"balances":{"btcSats":${JSON.stringify(btcSats.toString())},` +
          `"usdb":{"amount":"unknown",` +
          `"status":"not-covered-by-bitcoin-unilateral-exit"}},` +
          `"_recoveryNotes":${JSON.stringify(recoveryNotes)}}`;

        setStep('sharing');
        const response = await writeAndShareFileToFilesystem(
          fileData,
          'BlitzWallet-leaves-backup.json',
          'application/json',
        );
        if (!mountedRef.current) return;

        if (!response.success) {
          finishWithError(response.error);
          return;
        }
        navigate.goBack();
      } catch (err) {
        console.log('export leaves error', err);
        finishWithError('screens.inAccount.walletLeaves.exportError');
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, [
    currentWalletMnemoinc,
    sparkInformation.identityPubKey,
    onExported,
    navigate,
  ]);

  return (
    <FullLoadingScreen
      text={t(STEP_MESSAGES[step])}
      textStyles={styles.message}
    />
  );
}

const styles = StyleSheet.create({
  message: {
    textAlign: 'center',
    includeFontPadding: false,
  },
});
