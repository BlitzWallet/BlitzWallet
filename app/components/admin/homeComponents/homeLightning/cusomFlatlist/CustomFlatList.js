import React from 'react';
import {FlatListProps, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useCustomFlatListHook} from './useCustomFlatListHooks';

function CustomFlatList({style, ...props}) {
  const [
    scrollHandler,
    styles,
    stickyElementStyle,
    topElementStyle,
    onLayoutHeaderElement,
    onLayoutTopListElement,
    onLayoutStickyElement,
  ] = useCustomFlatListHook();

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
