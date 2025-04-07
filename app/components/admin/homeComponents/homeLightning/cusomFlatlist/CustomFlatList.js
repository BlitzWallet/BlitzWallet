import React, {useCallback, useState} from 'react';
import {RefreshControl, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useCustomFlatListHook} from './useCustomFlatListHooks';
import {COLORS} from '../../../../../constants';
import {sync as syncLiquid} from '@breeztech/react-native-breez-sdk-liquid';
import {sync as syncLightning} from '@breeztech/react-native-breez-sdk';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';

function CustomFlatList({style, ...props}) {
  const {masterInfoObject} = useGlobalContextProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
  const [refreshing, setRefreshing] = useState(false);
  const [
    scrollHandler,
    styles,
    stickyElementStyle,
    topElementStyle,
    onLayoutHeaderElement,
    onLayoutTopListElement,
    onLayoutStickyElement,
  ] = useCustomFlatListHook();

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        syncLiquid(),
        masterInfoObject.liquidWalletSettings.isLightningEnabled
          ? syncLightning()
          : Promise.resolve(true),
      ]);
    } catch (err) {
      console.log('error refreshing', err);
    } finally {
      setRefreshing(false);
    }
  }, [masterInfoObject]);

  return (
    <View style={style}>
      <Animated.View
        style={[styles.stickyElement, stickyElementStyle]}
        onLayout={onLayoutStickyElement}>
        {props.StickyElementComponent}
      </Animated.View>

      <Animated.View
        style={[styles.topElement, topElementStyle]}
        onLayout={onLayoutTopListElement}>
        {props.TopListElementComponent}
      </Animated.View>

      <Animated.FlatList
        refreshControl={
          <RefreshControl
            colors={[
              darkModeType && theme ? COLORS.darkModeText : COLORS.primary,
            ]}
            tintColor={
              darkModeType && theme ? COLORS.darkModeText : COLORS.primary
            }
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        showsVerticalScrollIndicator={false}
        {...props}
        ListHeaderComponent={
          <Animated.View onLayout={onLayoutHeaderElement}>
            {props.HeaderComponent}
          </Animated.View>
        }
        ListHeaderComponentStyle={[
          props.ListHeaderComponentStyle,
          styles.header,
        ]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      />
    </View>
  );
}

export default CustomFlatList;
