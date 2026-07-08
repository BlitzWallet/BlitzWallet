import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import GetThemeColors from '../../../../../hooks/themeColors';
import { CENTER } from '../../../../../constants';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import {
  getGlobalLeafStats,
  EXIT_MIN_SATS,
} from '../../../../../functions/spark/leavesStorage';
import ExportLeaves from './exportLeaves';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { createFormattedDate } from '../../contacts/contactsPageComponents/utilityFunctions';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import openWebBrowser from '../../../../../functions/openWebBrowser';
import CustomButton from '../../../../../functions/CustomElements/button';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';

// Soft chip backgrounds behind the tinted bucket/learn icons.
const READY_TINT = 'rgba(41, 196, 103, 0.15)';
const BELOW_TINT = 'rgba(255, 172, 48, 0.18)';
const LEARN_TINT = 'rgba(3, 117, 246, 0.12)';

export default function WalletLeaves() {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { reconcileLeaves } = useSparkWallet();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundOffset, backgroundColor } = GetThemeColors();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFromStore = useCallback(async () => {
    const nextStats = await getGlobalLeafStats();
    setStats(nextStats);
  }, []);

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

  const fmtSats = useCallback(
    amount =>
      displayCorrectDenomination({
        amount,
        masterInfoObject: {
          ...masterInfoObject,
          userBalanceDenomination: 'sats',
        },
        fiatStats,
      }),
    [masterInfoObject, fiatStats],
  );

  if (loading || !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={textColor} />
      </View>
    );
  }

  const minLabel = EXIT_MIN_SATS.toLocaleString();
  const isReady = stats.exitEligible > 0;
  const belowCount = Math.max(stats.totalLeaves - stats.exitEligible, 0);
  const belowValue = Math.max(stats.totalValue - stats.exitEligibleValue, 0);
  const pillBackgroundColor = theme ? backgroundOffset : COLORS.darkModeText;

  const lastSyncedLabel =
    stats.lastSyncedAt > 0
      ? createFormattedDate(stats.lastSyncedAt, Date.now(), t)
      : t('screens.inAccount.walletLeaves.never');

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('screens.inAccount.settingsContent.wallet leaves')}
        containerStyles={{ marginBottom: 0 }}
      />
      <ThemeText
        styles={styles.lastSynced}
        content={t('screens.inAccount.walletLeaves.lastSynced', {
          time: lastSyncedLabel,
        })}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={textColor}
          />
        }
      >
        <View style={styles.balanceWrap}>
          <ThemeText
            styles={styles.balanceValue}
            content={fmtSats(stats.totalValue ?? 0)}
          />
          <ThemeText
            styles={styles.balanceCaption}
            content={t('screens.inAccount.walletLeaves.guide.balanceCaption', {
              leaves: stats?.totalLeaves ?? 0,
              trees: stats?.treeCount ?? 0,
            })}
          />
        </View>

        {/* Buckets */}
        <BucketRow
          backgroundOffset={pillBackgroundColor}
          chipColor={backgroundColor}
          iconName="Check"
          title={t('screens.inAccount.walletLeaves.bucketReadyTitle')}
          subtitle={t('screens.inAccount.walletLeaves.bucketReadySub', {
            min: minLabel,
          })}
          count={stats.exitEligible}
          valueLabel={fmtSats(stats.exitEligibleValue)}
        />
        <BucketRow
          backgroundOffset={pillBackgroundColor}
          chipColor={backgroundColor}
          iconName="ArrowDown"
          title={t('screens.inAccount.walletLeaves.bucketBelowTitle')}
          subtitle={t('screens.inAccount.walletLeaves.bucketBelowSub')}
          count={belowCount}
          valueLabel={fmtSats(belowValue)}
        />

        {/* Learn strip */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            openWebBrowser({
              navigate,
              link: 'https://github.com/blinkbitcoin/spark-unilateral-exit',
            })
          }
          style={[styles.row, { backgroundColor: pillBackgroundColor }]}
        >
          <View style={[styles.chip, { backgroundColor: backgroundColor }]}>
            <ThemeIcon iconName="Globe" size={20} />
          </View>
          <View style={styles.rowText}>
            <ThemeText
              styles={styles.rowTitle}
              content={t('screens.inAccount.walletLeaves.exportTitle')}
            />
            <ThemeText
              styles={styles.rowSubtitle}
              content={t('screens.inAccount.walletLeaves.exportSubTitle')}
            />
          </View>
          <ThemeIcon iconName="ChevronRight" size={20} />
        </TouchableOpacity>

        {/* Learn strip */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            openWebBrowser({
              navigate,
              link: 'https://docs.spark.money/wallets/unilateral-exit',
            })
          }
          style={[styles.row, { backgroundColor: pillBackgroundColor }]}
        >
          <View style={[styles.chip, { backgroundColor: backgroundColor }]}>
            <ThemeIcon iconName="CircleHelp" size={20} />
          </View>
          <View style={styles.rowText}>
            <ThemeText
              styles={styles.rowTitle}
              content={t('screens.inAccount.walletLeaves.learnTitle')}
            />
            <ThemeText
              styles={styles.rowSubtitle}
              content={t('screens.inAccount.walletLeaves.learnSubtitle')}
            />
          </View>
          <ThemeIcon iconName="ChevronRight" size={20} />
        </TouchableOpacity>
      </ScrollView>
      <ExportLeaves onExported={loadFromStore} />
    </GlobalThemeView>
  );
}

function BucketRow({
  backgroundOffset,
  chipColor,
  iconName,
  iconColor,
  title,
  subtitle,
  count,
  valueLabel,
}) {
  return (
    <View style={[styles.row, { backgroundColor: backgroundOffset }]}>
      <View style={[styles.chip, { backgroundColor: chipColor }]}>
        <ThemeIcon iconName={iconName} size={20} colorOverride={iconColor} />
      </View>
      <View style={styles.rowText}>
        <ThemeText styles={styles.rowTitle} content={title} />
        <ThemeText styles={styles.rowSubtitle} content={subtitle} />
      </View>
      <View style={styles.rowRight}>
        <ThemeText styles={styles.rowCount} content={String(count)} />
        <ThemeText styles={styles.rowValue} content={valueLabel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  balanceWrap: { marginBottom: 20 },
  balanceValue: {
    fontSize: SIZES.huge,
    includeFontPadding: false,
    textAlign: 'center',
  },
  balanceCaption: {
    opacity: HIDDEN_OPACITY,
    marginTop: 4,
    marginBottom: 20,
    includeFontPadding: false,
    textAlign: 'center',
  },
  content: {
    paddingTop: 30,
    paddingBottom: 50,
  },
  heroCard: {
    width: '100%',
    borderRadius: 28,
    padding: 24,
    marginBottom: 12,
  },
  row: {
    width: '100%',
    borderRadius: 20,
    padding: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontWeight: '500',
    includeFontPadding: false,
  },
  rowSubtitle: {
    fontSize: SIZES.small,
    opacity: 0.6,
    marginTop: 2,
    includeFontPadding: false,
  },
  rowRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  rowCount: {
    includeFontPadding: false,
  },
  rowValue: {
    fontSize: SIZES.small,
    opacity: 0.6,
    marginTop: 2,
    includeFontPadding: false,
  },
  lastSynced: {
    fontSize: SIZES.small,
    opacity: 0.6,
    includeFontPadding: false,
    textAlign: 'center',
  },
});
