import { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { CONTENT_KEYBOARD_OFFSET, FONT } from '../../../../constants';
import { COLORS } from '../../../../constants/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useGifts } from '../../../../../context-store/giftContext';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../functions/CustomElements/button';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import ThemeText from '../../../../functions/CustomElements/textTheme';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useToast } from '../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../functions';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import ProgressBar from '../../../../functions/CustomElements/redesign/ProgressBar';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import { AssetDisc } from '../savings/savingsSheetParts';
import {
  formatGiftAmount,
  giftAsset,
  giftNumberLabel,
  giftShortDate,
} from './giftDisplay';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const GIFT_T = 'screens.inAccount.giftPages.giftsOverview';

const isOver = gift => gift.state === 'Claimed' || gift.state === 'Reclaimed';
const isActive = (gift, now) =>
  !isOver(gift) && gift.state !== 'Expired' && now < gift.expireTime;

export default function GiftsOverview() {
  const navigate = useNavigation();
  const { giftsArray, checkForRefunds, updateGiftList } = useGifts();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const giftList = await updateGiftList();
        await checkForRefunds(giftList);
      })();
    }, [updateGiftList, checkForRefunds]),
  );

  const { tokens } = GetThemeColors();

  const handleRefresh = async () => {
    const giftList = await updateGiftList();
    await checkForRefunds(giftList);
    setRefreshing(false);
  };

  const colors = useMemo(
    () =>
      Platform.select({
        ios: darkModeType && theme ? tokens.ink : tokens.accent,
        android: darkModeType && theme ? COLORS.lightModeText : tokens.accent,
      }),
    [darkModeType, theme],
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        colors={[colors]}
        tintColor={darkModeType && theme ? tokens.ink : tokens.accent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    ),
    [colors, refreshing, handleRefresh, darkModeType, theme],
  );

  const { active, past } = useMemo(() => {
    const now = Date.now();
    return {
      active: giftsArray
        .filter(g => isActive(g, now))
        .sort((a, b) => a.expireTime - b.expireTime),
      past: giftsArray.filter(g => !isActive(g, now)),
    };
  }, [giftsArray]);

  const copyLink = gift => {
    if (gift.claimURL) copyToClipboard(gift.claimURL, showToast);
    else
      navigate.navigate('ErrorScreen', {
        errorMessage: t(`${GIFT_T}.noClaimURL`),
      });
  };

  const amountOf = gift =>
    formatGiftAmount({ gift, masterInfoObject, fiatStats });
  const titleOf = gift =>
    gift.description ||
    `${t('constants.gift')} ${giftNumberLabel(gift.giftNum)}`;
  const progressOf = gift =>
    gift.createdTime
      ? 1 -
        (gift.expireTime - Date.now()) / (gift.expireTime - gift.createdTime)
      : 1;
  const endsInText = gift => {
    const diff = gift.expireTime - Date.now();
    if (diff >= DAY)
      return t(`${GIFT_T}.activeEndsIn.days`, {
        count: Math.floor(diff / DAY),
      });
    if (diff >= HOUR)
      return t(`${GIFT_T}.activeEndsIn.hours`, {
        count: Math.floor(diff / HOUR),
      });
    if (diff >= MINUTE)
      return t(`${GIFT_T}.activeEndsIn.minutes`, {
        count: Math.floor(diff / MINUTE),
      });
    return t(`${GIFT_T}.activeEndsIn.lessThanMin`);
  };

  const reclaim = gift =>
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'ClaimGiftScreen',
      url: gift.uuid,
      claimType: 'reclaim',
    });

  const mutedStyle = { color: tokens.muted };

  const renderHero = gift => (
    <View style={[styles.hero, { backgroundColor: tokens.surface }]}>
      <View style={styles.heroTop}>
        <AssetDisc asset={giftAsset(gift)} />
        <View style={styles.flex}>
          <ThemeText content={titleOf(gift)} styles={styles.title} />
          <ThemeText
            content={
              gift.description
                ? giftNumberLabel(gift.giftNum)
                : t(`${GIFT_T}.noNote`)
            }
            styles={[styles.sub, mutedStyle]}
          />
        </View>
      </View>
      <ThemeText content={amountOf(gift)} styles={styles.heroAmount} />
      <ThemeText
        content={endsInText(gift)}
        styles={[styles.status, mutedStyle]}
      />
      <ProgressBar value={progressOf(gift)} height={6} style={styles.heroBar} />
      <ThemeText
        content={t(`${GIFT_T}.claimNoteSingle`, {
          date: giftShortDate(gift.expireTime),
        })}
        styles={[styles.sub, styles.heroNote, mutedStyle]}
      />
      <Pressable
        onPress={() => copyLink(gift)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.copyButton,
          { backgroundColor: tokens.ground },
          pressed && { opacity: 0.6 },
        ]}
      >
        <ThemeIcon redesign iconName="Copy" size={18} />
        <ThemeText content={t(`${GIFT_T}.copyLink`)} styles={styles.copyText} />
      </Pressable>
    </View>
  );

  const renderCompact = gift => (
    <Pressable
      key={gift.uuid}
      onPress={() => copyLink(gift)}
      style={({ pressed }) => [
        styles.compact,
        { backgroundColor: tokens.surface },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={styles.compactTop}>
        <AssetDisc asset={giftAsset(gift)} />
        <View style={styles.flex}>
          <ThemeText content={titleOf(gift)} styles={styles.title} />
          <ThemeText
            content={`${
              gift.description
                ? giftNumberLabel(gift.giftNum)
                : t(`${GIFT_T}.noNote`)
            } · ${t(`${GIFT_T}.endsOn`, {
              date: giftShortDate(gift.expireTime),
            })}`}
            styles={[styles.sub, mutedStyle]}
          />
        </View>
        <ThemeText content={amountOf(gift)} styles={styles.amount} />
        <ThemeIcon redesign iconName="Copy" size={16} />
      </View>
      <ProgressBar
        value={progressOf(gift)}
        height={6}
        style={styles.compactBar}
      />
    </Pressable>
  );

  const renderPast = gift => {
    const reclaimable = !isOver(gift);
    const status =
      isOver(gift) || gift.state === 'Expired'
        ? t(`${GIFT_T}.${gift.state.toLowerCase()}`)
        : t(`${GIFT_T}.expired`);
    return (
      <ListRow
        key={gift.uuid}
        minHeight={64}
        lead={<AssetDisc asset={giftAsset(gift)} />}
        title={titleOf(gift)}
        titleStyle={styles.title}
        sub={
          gift.description
            ? giftNumberLabel(gift.giftNum)
            : t(`${GIFT_T}.noNote`)
        }
        onPress={reclaimable ? () => reclaim(gift) : undefined}
        trailing={
          <View style={styles.pastTrailing}>
            <ThemeText content={amountOf(gift)} styles={styles.amount} />
            <ThemeText content={status} styles={[styles.sub, mutedStyle]} />
          </View>
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      {giftsArray.length > 0 ? (
        <CustomScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          {active.length === 1 && renderHero(active[0])}
          {active.length > 1 && (
            <>
              <SectionHeader
                title={t(`${GIFT_T}.activeCount`, { count: active.length })}
              />
              <View style={styles.compactList}>
                {active.map(renderCompact)}
              </View>
              <ThemeText
                content={t(`${GIFT_T}.claimNoteMany`)}
                styles={[styles.sub, styles.manyNote, mutedStyle]}
              />
            </>
          )}
          {past.length > 0 && (
            <>
              <SectionHeader title={t(`${GIFT_T}.pastGifts`)} />
              <ListCard>{past.map(renderPast)}</ListCard>
            </>
          )}
        </CustomScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon={'Gift'}
            title={t(`${GIFT_T}.noGiftsHead`)}
            sub={t(`${GIFT_T}.noGiftsDesc`)}
          />
        </View>
      )}

      <View style={styles.buttonGroup}>
        <CustomButton
          actionFunction={() => navigate.navigate('CreateGift')}
          textContent={t(`${GIFT_T}.createGift`)}
          size={'regular'}
        />
        <CustomButton
          actionFunction={() =>
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'ClaimGiftHomeHalfModal',
            })
          }
          textContent={t('screens.inAccount.giftPages.claimHome.claim')}
          tone={'secondary'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { flexGrow: 1, paddingTop: 4, paddingBottom: 16 },
  buttonGroup: {
    gap: 10,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
  hero: { borderRadius: 24, padding: 20, marginTop: 20 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroAmount: {
    fontFamily: FONT.Title_Medium,
    fontSize: 36,
    lineHeight: 48,
    letterSpacing: -0.7,
    includeFontPadding: false,
    marginTop: 14,
  },
  status: {
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    marginTop: 2,
  },
  heroBar: { marginTop: 14 },
  heroNote: { marginTop: 10 },
  copyButton: {
    minHeight: 52,
    borderRadius: 999,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  copyText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 16,
    lineHeight: 22,
    includeFontPadding: false,
  },
  compactList: { gap: 8 },
  compact: { borderRadius: 20, padding: 16 },
  compactTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  compactBar: { marginTop: 12 },
  manyNote: { marginTop: 12, marginHorizontal: 4 },
  title: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  sub: {
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  amount: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  pastTrailing: { alignItems: 'flex-end' },
});
