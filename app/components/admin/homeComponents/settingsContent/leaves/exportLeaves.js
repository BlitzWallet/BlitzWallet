import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import DeviceInfo from 'react-native-device-info';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../constants/theme';
import writeAndShareFileToFilesystem from '../../../../../functions/writeFileToFilesystem';
import { getSparkLeaves } from '../../../../../functions/spark';
import {
  replaceAllLeaves,
  getAllLeavesStream,
} from '../../../../../functions/spark/leavesStorage';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../../constants';

// Maps the SDK Network enum int to the label the recovery tooling expects.
const NETWORK_LABELS = {
  1: 'MAINNET',
  2: 'REGTEST',
  3: 'TESTNET',
  4: 'SIGNET',
};

// Exports a plaintext JSON backup of every leaf (all public data) for a
// unilateral exit, in the reference `spark.unilateral-exit-bundle.v1` schema so
// the spark-unilateral-exit tooling can ingest it directly. It is a superset:
// each leaf carries the canonical `treeNodeHex`/`valueSats` the tooling reads
// plus our richer per-leaf fields (validator tolerates extra keys). Forces a
// full getLeaves(false) snapshot first, then streams the file assembly
// batch-by-batch so a large leaf set never blocks the UI.
//
// NOTE: this is leaves-only. Ancestor/parent TreeNodes are not exported (the
// SDK's getLeaves is includeParents:false and queryNodes is private), so offline
// unilateral exit of multi-level trees still needs live Spark operators or the
// reference Rust exporter. This is surfaced to the user via `_recoveryNotes`.
export default function ExportLeaves({ onExported }) {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sparkInformation } = useSparkWallet();
  const [loading, setLoading] = useState(false);

  const handleExport = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Full, cross-operator, recovered snapshot — the trustworthy exit copy.
      const rawLeaves = await getSparkLeaves(currentWalletMnemoinc, false);
      if (!Array.isArray(rawLeaves) || rawLeaves.length === 0) {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'screens.inAccount.walletLeaves.noLeavesToExport',
          useTranslationString: true,
        });
        return;
      }

      await replaceAllLeaves(rawLeaves);
      if (onExported) onExported();

      // Assemble the file from the stored leaves in yielding batches rather than
      // one giant nested JSON.stringify. Accumulate the total sats and capture
      // the network int from the first leaf while streaming.
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

      const networkLabel = NETWORK_LABELS[networkInt] || 'MAINNET';
      const recoveryNotes =
        'Leaves only. Ancestor/parent TreeNodes are not included; offline ' +
        'unilateral exit of multi-level trees needs live Spark operators or the ' +
        'reference Rust exporter (tools/spark-recovery-bundle). See the ' +
        'spark-unilateral-exit guide.';

      const fileData =
        `{"schema":"spark.unilateral-exit-bundle.v1",` +
        `"createdAt":${JSON.stringify(new Date().toISOString())},` +
        `"network":${JSON.stringify(networkLabel)},` +
        `"operatorSet":"spark-sdk",` +
        `"walletIdentityPublicKey":${JSON.stringify(
          sparkInformation.identityPubKey || '',
        )},` +
        `"sparkSdkVersion":"unknown",` +
        `"appVersion":${JSON.stringify(DeviceInfo.getVersion())},` +
        `"leafCount":${parts.length},` +
        `"leaves":[${parts.join(',')}],` +
        `"nodes":[],` +
        `"balances":{"btcSats":${JSON.stringify(btcSats.toString())},` +
        `"usdb":{"amount":"unknown",` +
        `"status":"not-covered-by-bitcoin-unilateral-exit"}},` +
        `"_recoveryNotes":${JSON.stringify(recoveryNotes)}}`;

      const response = await writeAndShareFileToFilesystem(
        fileData,
        'BlitzWallet-leaves-backup.json',
        'application/json',
      );

      if (!response.success) {
        navigate.navigate('ErrorScreen', {
          errorMessage: response.error,
          useTranslationString: true,
        });
      }
    } catch (err) {
      console.log('export leaves error', err);
      navigate.navigate('ErrorScreen', {
        errorMessage: 'screens.inAccount.walletLeaves.exportError',
        useTranslationString: true,
      });
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    currentWalletMnemoinc,
    sparkInformation.identityPubKey,
    navigate,
    onExported,
  ]);

  return (
    <View style={styles.container}>
      <CustomButton
        actionFunction={handleExport}
        useLoading={loading}
        disabled={loading}
        textContent={t('screens.inAccount.walletLeaves.exportButton')}
        buttonStyles={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
  button: {
    width: '100%',
  },
  note: {
    fontSize: SIZES.small,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 10,
    includeFontPadding: false,
  },
});
