import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
  SIZES,
} from '../../../../constants';
import { FONT } from '../../../../constants/theme';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { usePools } from '../../../../../context-store/poolContext';
import CustomButton from '../../../../functions/CustomElements/button';
import PoolCard from './poolCard';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { useTranslation } from 'react-i18next';
import InfoDropdown from '../../../../functions/CustomElements/redesign/InfoDropdown';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';

export default function PoolManagementScreen() {
  const navigate = useNavigation();
  const {
    activePoolsArray,
    closedPoolsArray,
    syncActivePoolsFromServer,
    updatePoolList,
  } = usePools();

  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const [isRefreshing, setIsRefreshing] = useState(true);

  const hasActivePools = activePoolsArray.length > 0;
  const hasClosedPools = closedPoolsArray.length > 0;
  const hasAnyPools = hasActivePools || hasClosedPools;

  const handleCreatePool = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'createPoolFlow',
      sliderHight: 0.6,
    });
  }, [navigate]);

  const handlePoolPress = useCallback(
    pool => {
      navigate.navigate('PoolDetailScreen', {
        poolId: pool.poolId,
        pool,
      });
    },
    [navigate],
  );

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadPools() {
        try {
          const pools = await updatePoolList();
          await syncActivePoolsFromServer(pools);
        } finally {
          if (isMounted) {
            setIsRefreshing(false);
          }
        }
      }

      loadPools();

      return () => {
        isMounted = false;
      };
    }, [updatePoolList, syncActivePoolsFromServer]),
  );

  const sections = [
    {
      poolId: 'active',
      title: t('wallet.pools.active'),
      pools: activePoolsArray,
      emptyMessage: t('wallet.pools.noActivePools'),
    },
    {
      poolId: 'closed',
      title: t('wallet.pools.closedSection'),
      pools: closedPoolsArray,
      emptyMessage: t('wallet.pools.noClosedPools'),
    },
  ];

  const renderPoolSection = useCallback(
    ({ item }) => {
      const hasPools = item.pools.length > 0;

      return (
        <View style={styles.section}>
          <SectionHeader title={item.title} />

          {hasPools ? (
            <ListCard>
              {item.pools.map(pool => (
                <PoolCard
                  key={pool.poolId}
                  pool={pool}
                  onPress={() => handlePoolPress(pool)}
                />
              ))}
            </ListCard>
          ) : (
            <ThemeText
              styles={styles.emptySection}
              content={item.emptyMessage}
            />
          )}
        </View>
      );
    },
    [handlePoolPress],
  );

  if (isRefreshing) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <FullLoadingScreen />
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.innerContainer, { width: contentWidth }]}>
        <TopBar title={t('screens.inAccount.settingsContent.pools')} />

        <FlatList
          data={hasAnyPools ? sections : []}
          renderItem={renderPoolSection}
          keyExtractor={item => item.poolId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <EmptyState
                icon="PiggyBank"
                title={t('wallet.pools.noPoolsTitle')}
                sub={t('wallet.pools.noPoolsSubTitle')}
              />
            </View>
          }
          ListHeaderComponent={
            <InfoDropdown
              icon="Info"
              title={t('wallet.pools.info.title')}
              infoComponenet={
                <>
                  <ThemeText
                    styles={styles.sectionTitle}
                    content={t('wallet.pools.info.whatArePools')}
                  />

                  <ThemeText
                    styles={styles.bodyText}
                    content={t('wallet.pools.info.whatArePoolsBody')}
                  />

                  <ThemeText
                    styles={styles.sectionTitle}
                    content={t('wallet.pools.info.howItWorks')}
                  />

                  <ThemeText
                    styles={styles.bulletText}
                    content={t('wallet.pools.info.howStep1')}
                  />

                  <ThemeText
                    styles={styles.bulletText}
                    content={t('wallet.pools.info.howStep2')}
                  />

                  <ThemeText
                    styles={styles.bulletText}
                    content={t('wallet.pools.info.howStep3')}
                  />

                  <ThemeText
                    styles={styles.bulletText}
                    content={t('wallet.pools.info.howStep4')}
                  />
                </>
              }
            />
          }
        />

        <CustomButton
          buttonStyles={styles.createButton}
          textContent={t('wallet.pools.createPool')}
          actionFunction={handleCreatePool}
          size="regular"
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    ...CENTER,
  },
  listContent: {
    flexGrow: 1,
  },
  section: {
    marginBottom: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySection: {
    fontSize: SIZES.medium,
    opacity: 0.6,
    textAlign: 'center',
    paddingVertical: 20,
  },
  createButton: {
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
  sectionTitle: {
    fontSize: SIZES.smedium,
    fontFamily: FONT.Title_Medium,
    marginTop: 12,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: SIZES.small,
    opacity: 0.8,
    lineHeight: 18,
  },
  bulletText: {
    fontSize: SIZES.small,
    opacity: 0.8,
    lineHeight: 18,
    paddingLeft: 8,
    marginBottom: 2,
  },
});
