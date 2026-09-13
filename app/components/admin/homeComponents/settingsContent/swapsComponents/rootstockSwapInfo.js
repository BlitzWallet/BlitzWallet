import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useNavigation } from '@react-navigation/native';
import CustomButton from '../../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import { useKeysContext } from '../../../../../../context-store/keys';
import { useToast } from '../../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../../functions';
import { useTranslation } from 'react-i18next';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { getRootstockSwapStatusLabel } from '../../../../../functions/boltz/rootstock/swapProgress';
import {
  isRootstockSwapPendingRefund,
  isRootstockSwapTerminalFailureStatus,
} from '../../../../../functions/boltz/rootstock/swapStatus';

const EMPTY_VALUE = '--';

function truncateMiddle(value) {
  if (!value) return EMPTY_VALUE;
  const str = String(value);
  if (str.length <= 16) return str;
  return `${str.slice(0, 8)}…${str.slice(-6)}`;
}

function formatDate(value) {
  if (!value) return null;
  const num = Number(value);
  if (!num) return null;
  return new Date(num).toLocaleString();
}

export default function RootstockSwapInfo({ swap, handleBackPressFunction }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const navigate = useNavigation();
  const { accountMnemoinc } = useKeysContext();
  const [isRefunding, setIsRefunding] = useState(false);
  const { showToast } = useToast();
  const { t } = useTranslation();

  const showRefundError = () =>
    showToast({
      type: 'error',
      title: t('settings.rootstockSwapInfo.refundError'),
    });

  const data = swap?.data || {};
  const status = data?.status;

  const rows = [
    {
      label: t('settings.rootstockSwapInfo.date'),
      value: formatDate(data?.createdAt),
    },
    {
      label: t('settings.rootstockSwapInfo.completed'),
      value: formatDate(data?.completedAt),
    },
    {
      label: t('settings.rootstockSwapInfo.refunded'),
      value: formatDate(data?.refundedAt),
    },
    {
      label: t('settings.rootstockSwapInfo.id'),
      value: swap?.id,
      copy: swap?.id,
    },
    {
      label: t('settings.rootstockSwapInfo.claimAddress'),
      value: data?.swap?.claimAddress,
      copy: data?.swap?.claimAddress,
    },
    {
      label: t('settings.rootstockSwapInfo.invoice'),
      value: data?.invoice,
      copy: data?.invoice,
    },
    {
      label: t('settings.rootstockSwapInfo.rootstockTx'),
      value: data?.rootstockPaymentTxId,
      copy: data?.rootstockPaymentTxId,
    },
    {
      label: t('settings.rootstockSwapInfo.lockTx'),
      value: data?.lockTxHash,
      copy: data?.lockTxHash,
    },
    {
      label: t('settings.rootstockSwapInfo.refundTx'),
      value: data?.refundTxHash,
      copy: data?.refundTxHash,
    },
  ].filter(row => row.value);

  const cardBackground =
    theme && darkModeType ? backgroundColor : backgroundOffset;

  // Also cover swaps the disabled retry loop used to re-drive: a failed refund
  // leaves refundState 'retryable_error' without didSwapFail, and a swap that
  // never reached the lifecycle handler has neither.
  const canRefund =
    !data?.refundTxHash &&
    (data?.didSwapFail ||
      isRootstockSwapPendingRefund(swap) ||
      isRootstockSwapTerminalFailureStatus(status));

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.hero}>
          <FormattedSatText
            balance={data?.amountSat || 0}
            styles={styles.amount}
          />
          <ThemeText
            styles={styles.status}
            content={getRootstockSwapStatusLabel(status) || EMPTY_VALUE}
          />
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground }]}>
          {rows.map((row, index) => {
            const isCopyable = !!row.copy;
            const RowWrapper = isCopyable ? TouchableOpacity : View;
            return (
              <RowWrapper
                key={row.label}
                activeOpacity={0.6}
                onPress={
                  isCopyable
                    ? () => copyToClipboard(String(row.copy), showToast)
                    : undefined
                }
                style={[
                  styles.row,
                  index !== rows.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor:
                      theme && darkModeType
                        ? backgroundOffset
                        : backgroundColor,
                  },
                ]}
              >
                <ThemeText styles={styles.rowLabel} content={row.label} />
                <ThemeText
                  CustomNumberOfLines={1}
                  styles={styles.rowValue}
                  content={isCopyable ? truncateMiddle(row.value) : row.value}
                />
              </RowWrapper>
            );
          })}
        </View>
      </ScrollView>

      {canRefund && (
        <CustomButton
          actionFunction={async () => {
            if (isRefunding) return;
            setIsRefunding(true);
            let provider;
            try {
              // Load Rootstock only for a user-requested refund.
              const {
                FallbackProvider,
                JsonRpcProvider,
                Wallet,
              } = require('ethers');
              const {
                getRoostockProviderEndpoints,
                getRoostockProviderNetwork,
                rootstockEnvironment,
              } = require('../../../../../functions/boltz/rootstock');
              const {
                refundRootstockSubmarineSwap,
              } = require('../../../../../functions/boltz/rootstock/claims');
              const network = getRoostockProviderNetwork(rootstockEnvironment);
              const providers = getRoostockProviderEndpoints(
                rootstockEnvironment,
              ).map((endpoint, index) => ({
                provider: new JsonRpcProvider(endpoint, network, {
                  staticNetwork: true,
                }),
                priority: index + 1,
                weight: 1,
                stallTimeout: 2000,
              }));
              provider =
                providers.length === 1
                  ? providers[0].provider
                  : new FallbackProvider(providers, network, { quorum: 1 });
              const signer =
                Wallet.fromPhrase(accountMnemoinc).connect(provider);
              const response = await refundRootstockSubmarineSwap(swap, signer);
              if (response) handleBackPressFunction();
              else showRefundError();
            } catch (err) {
              console.log('Error preparing rootstock refund', err);
              showRefundError();
            } finally {
              provider?.destroy();
              setIsRefunding(false);
            }
          }}
          buttonStyles={styles.refundButton}
          textContent={t('settings.rootstockSwapInfo.refundSwap')}
          useLoading={isRefunding}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 10,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  amount: {
    fontSize: 36,
    includeFontPadding: false,
  },
  status: {
    fontSize: SIZES.smedium,
    marginTop: 6,
    includeFontPadding: false,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLabel: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    marginRight: 16,
  },
  rowValue: {
    fontSize: SIZES.small,
    includeFontPadding: false,
    flexShrink: 1,
    textAlign: 'right',
    opacity: HIDDEN_OPACITY,
  },
  refundButton: {
    alignSelf: 'center',
    marginTop: 10,
  },
});
