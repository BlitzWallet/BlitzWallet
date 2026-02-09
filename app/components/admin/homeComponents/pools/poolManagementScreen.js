import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { CENTER, CONTENT_KEYBOARD_OFFSET, SIZES } from '../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { usePools } from '../../../../../context-store/poolContext';
import CustomButton from '../../../../functions/CustomElements/button';
import PoolCard from './poolCard';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import { useTranslation } from 'react-i18next';

export default function PoolManagementScreen() {
  const navigate = useNavigation();
  const {
    activePoolsArray,
    closedPoolsArray,
    syncActivePoolsFromServer,
    poolsArray,
  } = usePools();
  const { t } = useTranslation();

  const [isRefreshing, setIsRefreshing] = useState(true);

  const hasActivePools = activePoolsArray.length > 0;
  const hasClosedPools = closedPoolsArray.length > 0;
  const hasAnyPools = hasActivePools || hasClosedPools;

  const handleCreatePool = useCallback(() => {
    navigate.navigate('CreatePoolAmount');
  }, [navigate]);

  const handlePoolPress = useCallback(
    pool => {
      navigate.navigate('PoolDetailScreen', { poolId: pool.poolId, pool });
    },
    [navigate],
  );

  const renderPoolItem = useCallback(
    ({ item }) => {
      if (item.isHeader) {
        return <ThemeText styles={styles.sectionHeader} content={item.title} />;
      }

      if (item.isEmpty) {
        return (
          <ThemeText styles={styles.emptySection} content={item.message} />
        );
      }

      return <PoolCard pool={item} onPress={() => handlePoolPress(item)} />;
    },
    [handlePoolPress],
  );

  useFocusEffect(
    useCallback(() => {
      async function loadPools() {
        await syncActivePoolsFromServer(poolsArray);
        setIsRefreshing(false);
      }
      loadPools();
    }, []),
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <ThemeText
        styles={styles.emptyText}
        content={t('wallet.pools.noPoolsCreated')}
      />
    </View>
  );

  // Build data array based on what exists
  const buildPoolsData = () => {
    if (!hasAnyPools) {
      return [];
    }

    const data = [];

    // Active section
    data.push({
      title: t('constants.active'),
      isHeader: true,
      poolId: 'header-active',
    });
    if (hasActivePools) {
      data.push(...activePoolsArray);
    } else {
      data.push({
        isEmpty: true,
        message: t('wallet.pools.noActivePools'),
        poolId: 'empty-active',
      });
    }

    // Closed section
    data.push({
      title: t('wallet.pools.closedSection'),
      isHeader: true,
      poolId: 'header-closed',
    });
    if (hasClosedPools) {
      data.push(...closedPoolsArray);
    } else {
      data.push({
        isEmpty: true,
        message: t('wallet.pools.noClosedPools'),
        poolId: 'empty-closed',
      });
    }

    return data;
  };

  const pools = buildPoolsData();

  if (isRefreshing) {
    return <FullLoadingScreen />;
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={pools}
        renderItem={renderPoolItem}
        keyExtractor={item => item.poolId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />

      <CustomButton
        buttonStyles={styles.createButton}
        textContent={t('wallet.pools.createPool')}
        actionFunction={handleCreatePool}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    textAlign: 'center',
  },
  emptySection: {
    fontSize: SIZES.medium,
    opacity: 0.6,
    textAlign: 'center',
    paddingVertical: 20,
  },
  sectionHeader: {
    fontSize: SIZES.large,
    marginTop: 20,
    marginBottom: 12,
  },
  createButton: {
    ...CENTER,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
