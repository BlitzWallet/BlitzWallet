import React, { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { useKeysContext } from '../../../../../../context-store/keys';
import { useToast } from '../../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../../../context-store/theme';
import { getRootstockSwapStatusLabel } from '../../../../../functions/boltz/rootstock/swapProgress';
import { canRefundRootstockSwap } from '../../../../../functions/boltz/rootstock/swapStatus';
import { loadSwaps } from '../../../../../functions/boltz/rootstock/swapDb';
import { FONT } from '../../../../../constants';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import CustomButton from '../../../../../functions/CustomElements/button';
import ThemeText from '../../../../../functions/CustomElements/textTheme';
import KeyValueRow from '../../../../../functions/CustomElements/redesign/KeyValueRow';

const EMPTY_VALUE = '--';

function formatDate(value) {
  if (!value) return null;
  const num = Number(value);
  if (!num) return null;
  return new Date(num).toLocaleString();
}

function formatBlockHeight(value) {
  if (!value) return null;
  const num = Number(value);
  if (!num) return null;
  return num.toLocaleString();
}

export default function RootstockSwapInfo({ swap, handleBackPressFunction }) {
  const { accountMnemoinc } = useKeysContext();
  const [isRefunding, setIsRefunding] = useState(false);
  const [currentSwap, setCurrentSwap] = useState(swap);
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const showRefundError = () =>
    showToast({
      type: 'error',
      title: t('settings.rootstockSwapInfo.refundError'),
    });

  const data = currentSwap?.data || {};
  const status = data?.status;
  const canRefund = canRefundRootstockSwap(currentSwap);
  const statusLabel = data?.refundTxHash
    ? t('settings.rootstockSwapInfo.refunded')
    : canRefund
    ? t('settings.viewRoostockSwaps.transaction.lockupFailed')
    : getRootstockSwapStatusLabel(status) || EMPTY_VALUE;

  const rows = [
    {
      label: t('settings.rootstockSwapInfo.date'),
      value: formatDate(data?.createdAt),
      mono: false,
    },
    {
      label: t('settings.rootstockSwapInfo.id'),
      value: currentSwap?.id,
      copy: currentSwap?.id,
    },
    {
      label: t('settings.rootstockSwapInfo.claimAddress'),
      value: data?.swap?.claimAddress,
      copy: data?.swap?.claimAddress,
    },
    {
      label: t('settings.rootstockSwapInfo.lockTx'),
      value: data?.lockTxHash,
      copy: data?.lockTxHash,
    },
    {
      label: t('settings.rootstockSwapInfo.timeoutBHeight'),
      value: formatBlockHeight(data?.swap?.timeoutBlockHeight),
      mono: false,
    },
    {
      label: t('settings.rootstockSwapInfo.refundTx'),
      value: data?.refundTxHash,
      copy: data?.refundTxHash,
    },
  ].filter(row => row.value);

  const refund = async () => {
    if (isRefunding) return;
    setIsRefunding(true);
    let provider;
    try {
      // Load Rootstock only for a user-requested refund.
      const { FallbackProvider, JsonRpcProvider, Wallet } = require('ethers');
      const {
        getRoostockProviderEndpoints,
        getRoostockProviderNetwork,
        rootstockEnvironment,
      } = require('../../../../../functions/boltz/rootstock');
      const {
        refundRootstockSubmarineSwap,
      } = require('../../../../../functions/boltz/rootstock/claims');
      const network = getRoostockProviderNetwork(rootstockEnvironment);
      const providers = getRoostockProviderEndpoints(rootstockEnvironment).map(
        (endpoint, index) => ({
          provider: new JsonRpcProvider(endpoint, network, {
            staticNetwork: true,
          }),
          priority: index + 1,
          weight: 1,
          stallTimeout: 2000,
        }),
      );
      provider =
        providers.length === 1
          ? providers[0].provider
          : new FallbackProvider(providers, network, { quorum: 1 });
      const signer = Wallet.fromPhrase(accountMnemoinc).connect(provider);
      const response = await refundRootstockSubmarineSwap(currentSwap, signer);
      if (response) {
        const swaps = await loadSwaps();
        const updatedSwap = swaps.find(item => item.id === currentSwap?.id);
        if (updatedSwap) setCurrentSwap(updatedSwap);
        AccessibilityInfo.announceForAccessibility(
          t('settings.rootstockSwapInfo.refunded'),
        );
      } else {
        showRefundError();
      }
    } catch (err) {
      console.log('Error preparing rootstock refund', err);
      showRefundError();
    } finally {
      provider?.destroy();
      setIsRefunding(false);
    }
  };

  return (
    <CustomScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.hero}>
        <View
          style={[
            styles.pill,
            {
              backgroundColor: canRefund ? tokens.dangerBg : tokens.disc,
            },
          ]}
        >
          <ThemeText
            styles={[
              styles.pillText,
              { color: canRefund ? tokens.danger : tokens.ink },
            ]}
            content={statusLabel}
          />
        </View>
        <FormattedSatText
          balance={data?.amountSat || 0}
          styles={{ ...styles.amount, color: tokens.ink }}
        />
        <ThemeText
          styles={[styles.subtitle, { color: tokens.muted }]}
          content={t('settings.rootstockSwapInfo.subtitle')}
        />
      </View>

      <View style={[styles.details, { backgroundColor: tokens.ground }]}>
        {rows.map(row => (
          <KeyValueRow
            key={row.label}
            label={row.label}
            value={row.value}
            copyValue={row.copy}
            copyLabel={
              row.copy ? `${t('constants.copy')} ${row.label}` : undefined
            }
            truncate={row.copy ? 'middle' : undefined}
            mono={row.mono !== false}
          />
        ))}
      </View>

      {canRefund && (
        <CustomButton
          size="regular"
          tone="primary"
          buttonStyles={styles.refundButton}
          actionFunction={refund}
          textContent={t('settings.rootstockSwapInfo.refundSwap')}
          useLoading={isRefunding}
        />
      )}
    </CustomScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  hero: {
    alignItems: 'flex-start',
    gap: 8,
  },
  pill: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  amount: {
    fontFamily: FONT.Title_Medium,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.68,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  subtitle: {
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  details: {
    marginTop: 12,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  refundButton: {
    width: '100%',
    marginTop: 20,
  },
});
