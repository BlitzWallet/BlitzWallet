import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { loadSwaps } from '../../../../../functions/boltz/rootstock/swapDb';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { ThemeText } from '../../../../../functions/CustomElements';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getRootstockSwapStatusLabel } from '../../../../../functions/boltz/rootstock/swapProgress';
import { canRefundRootstockSwap } from '../../../../../functions/boltz/rootstock/swapStatus';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useTheme } from '../../../../../../context-store/theme';
import { FONT } from '../../../../../constants';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import SupportMessage from './supportMessage';

export default function RoostockSwapsPage() {
  const [swapList, setSwapList] = useState(null);
  const { tokens } = useTheme();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const navigate = useNavigation();
  const { t } = useTranslation();

  useFocusEffect(
    useCallback(() => {
      async function loadSavedSwaps() {
        const swaps = await loadSwaps();
        setSwapList(
          (swaps || []).sort((a, b) => {
            const aTime =
              a?.data?.lastStatusAt ||
              a?.data?.completedAt ||
              a?.data?.refundedAt ||
              a?.data?.createdAt ||
              0;
            const bTime =
              b?.data?.lastStatusAt ||
              b?.data?.completedAt ||
              b?.data?.refundedAt ||
              b?.data?.createdAt ||
              0;
            return bTime - aTime;
          }),
        );
      }
      loadSavedSwaps();
    }, []),
  );

  if (swapList === null) {
    return (
      <FullLoadingScreen
        textStyles={styles.loadingText}
        text={t('settings.viewRoostockSwaps.loadingMessage')}
      />
    );
  }
  if (!swapList?.length) {
    return <SupportMessage type={t('settings.viewSwapsHome.rootstock')} />;
  }

  return (
    <CustomScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <ListCard dividerInset={0} style={styles.card}>
        {swapList.map(item => {
          const status = item?.data?.status;
          const needsRefund = canRefundRootstockSwap(item);
          const label = needsRefund
            ? t('settings.viewRoostockSwaps.transaction.lockupFailed')
            : getRootstockSwapStatusLabel(status) || '--';
          const amount = displayCorrectDenomination({
            amount: item?.data?.amountSat,
            masterInfoObject,
            fiatStats,
          });

          return (
            <ListRow
              key={item.id}
              title={amount}
              sub={`${item.id}`}
              minHeight={64}
              titleStyle={styles.amount}
              subStyle={styles.swapId}
              accessibilityLabel={`${amount}, ${label}`}
              onPress={() =>
                navigate.navigate('CustomHalfModal', {
                  wantedContent: 'rootstockSwapInfo',
                  swap: item,
                })
              }
              trailing={
                <View style={styles.statusContainer}>
                  <ThemeText
                    CustomNumberOfLines={2}
                    styles={[
                      styles.status,
                      { color: needsRefund ? tokens.danger : tokens.muted },
                    ]}
                    content={label}
                  />
                  <ThemeIcon
                    redesign
                    iconName="ChevronRight"
                    size={18}
                    colorOverride={tokens.muted}
                  />
                </View>
              }
            />
          );
        })}
      </ListCard>
    </CustomScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  card: { marginTop: 16 },
  amount: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  swapId: {
    fontFamily: FONT.mono,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  status: {
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    flexShrink: 1,
    textAlign: 'right',
  },
  loadingText: {
    textAlign: 'center',
  },
});
