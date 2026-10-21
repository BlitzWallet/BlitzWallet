import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import { MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import { useTheme } from '../../../../../../context-store/theme';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import {
  getGlobalLeafStats,
  EXIT_MIN_SATS,
} from '../../../../../functions/spark/leavesStorage';
import formatBalanceAmount from '../../../../../functions/formatNumber';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { createFormattedDate } from '../../contacts/contactsPageComponents/utilityFunctions';
import openWebBrowser from '../../../../../functions/openWebBrowser';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import AmountHero from '../../../../../functions/CustomElements/redesign/AmountHero';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../../context-store/nodeContext';

export default function WalletLeaves() {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { reconcileLeaves, sparkInformation } = useSparkWallet();
  const { fiatStats } = useNodeContext();
  const { tokens } = useTheme();
  const { masterInfoObject } = useGlobalContextProvider();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFromStore = useCallback(async () => {
    const nextStats = await getGlobalLeafStats(sparkInformation.identityPubKey);
    setStats(nextStats);
  }, [sparkInformation.identityPubKey, sparkInformation.leaves]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          await loadFromStore();
        } catch (err) {
          console.log('load leaves store error', err);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [loadFromStore]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reconcileLeaves(true);
      await loadFromStore();
    } catch (err) {
      console.log('refresh leaves error', err);
    } finally {
      setRefreshing(false);
    }
  }, [reconcileLeaves, loadFromStore]);

  if (loading || !stats) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.content, { width: contentWidth }]}>
          <TopBar
            title={t('screens.inAccount.settingsContent.wallet leaves')}
          />
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={tokens.ink} />
          </View>
        </View>
      </GlobalThemeView>
    );
  }

  const minLabel = EXIT_MIN_SATS.toLocaleString();
  const belowCount = Math.max(stats.totalLeaves - stats.exitEligible, 0);
  const belowValue = Math.max(stats.totalValue - stats.exitEligibleValue, 0);

  const openExport = () =>
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'exportLeavesProgress',
      onExported: loadFromStore,
      sliderHight: 0.66,
    });

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.content, { width: contentWidth }]}>
        <TopBar title={t('screens.inAccount.settingsContent.wallet leaves')} />
        <ThemeText
          content={t('screens.inAccount.walletLeaves.lastSynced', {
            time:
              stats.lastSyncedAt > 0
                ? createFormattedDate(stats.lastSyncedAt, Date.now(), t)
                : t('screens.inAccount.walletLeaves.never'),
          })}
          styles={[styles.lastSynced, { color: tokens.muted }]}
        />
        <CustomScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tokens.ink}
            />
          }
        >
          <View style={styles.hero}>
            <AmountHero
              value={displayCorrectDenomination({
                amount: stats.totalValue ?? 0,
                masterInfoObject,
                fiatStats,
              })}
              amountSize={44}
              unitSize={22}
              lineHeight={48}
            />
          </View>
          <ThemeText
            content={t('screens.inAccount.walletLeaves.guide.balanceCaption', {
              leaves: stats?.totalLeaves ?? 0,
              trees: stats?.treeCount ?? 0,
            })}
            styles={[styles.caption, { color: tokens.muted }]}
          />

          <ListCard dividerInset={68} style={styles.bucketsCard}>
            <ListRow
              title={t('screens.inAccount.walletLeaves.bucketReadyTitle')}
              sub={t('screens.inAccount.walletLeaves.bucketReadySub', {
                min: minLabel,
              })}
              minHeight={68}
              titleStyle={styles.rowTitle}
              subStyle={styles.rowSub}
              lead={<Disc icon="Check" size={40} tone="primary" />}
              trailing={
                <View style={styles.trailing}>
                  <ThemeText
                    content={String(stats.exitEligible)}
                    styles={styles.trailingCount}
                  />
                  <ThemeText
                    content={displayCorrectDenomination({
                      amount: stats.exitEligibleValue,
                      masterInfoObject,
                      fiatStats,
                    })}
                    styles={[styles.trailingValue, { color: tokens.muted }]}
                  />
                </View>
              }
            />
            <ListRow
              title={t('screens.inAccount.walletLeaves.bucketBelowTitle')}
              sub={t('screens.inAccount.walletLeaves.bucketBelowSub')}
              minHeight={68}
              titleStyle={styles.rowTitle}
              subStyle={styles.rowSub}
              lead={<Disc icon="Layers" size={40} />}
              trailing={
                <View style={styles.trailing}>
                  <ThemeText
                    content={String(belowCount)}
                    styles={styles.trailingCount}
                  />
                  <ThemeText
                    content={displayCorrectDenomination({
                      amount: belowValue,
                      masterInfoObject,
                      fiatStats,
                    })}
                    styles={[styles.trailingValue, { color: tokens.muted }]}
                  />
                </View>
              }
            />
          </ListCard>

          <ListCard dividerInset={64} style={styles.actionsCard}>
            <ListRow
              title={t('screens.inAccount.walletLeaves.exportButton')}
              minHeight={64}
              titleStyle={styles.rowTitle}
              subStyle={styles.rowSub}
              lead={<Disc icon="HardDriveDownload" size={36} />}
              trailing="chevron"
              chevronSize={18}
              onPress={openExport}
            />
            <ListRow
              title={t('screens.inAccount.walletLeaves.learnTitle')}
              sub={t('screens.inAccount.walletLeaves.learnSubtitle')}
              minHeight={64}
              titleStyle={styles.rowTitle}
              subStyle={styles.rowSub}
              lead={<Disc icon="BookOpen" size={36} />}
              trailing="chevron"
              chevronSize={18}
              onPress={() =>
                openWebBrowser({
                  navigate,
                  link: 'https://docs.spark.money/wallets/unilateral-exit',
                })
              }
            />
            <ListRow
              title={t('screens.inAccount.walletLeaves.guide.openBlink')}
              sub={t('screens.inAccount.walletLeaves.exportSubTitle')}
              minHeight={64}
              titleStyle={styles.rowTitle}
              lead={<Disc icon="ExternalLink" size={36} />}
              trailing="chevron"
              chevronSize={18}
              onPress={() =>
                openWebBrowser({
                  navigate,
                  link: 'https://github.com/blinkbitcoin/spark-unilateral-exit',
                })
              }
            />
          </ListCard>
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  hero: { marginTop: 20 },
  lastSynced: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false,
    marginTop: 2,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false,
    marginTop: 2,
  },
  bucketsCard: { marginTop: 24 },
  actionsCard: { marginTop: 12 },
  rowTitle: {
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  rowSub: {
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
    marginTop: 0,
  },
  trailing: { alignItems: 'flex-end' },
  trailingCount: {
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  trailingValue: {
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
});
