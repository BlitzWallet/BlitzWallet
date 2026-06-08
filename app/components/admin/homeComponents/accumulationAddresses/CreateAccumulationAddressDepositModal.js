import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import GetThemeColors from '../../../../hooks/themeColors';

import {
  ACCUMULATION_CHAINS,
  getChainExpandHeight,
} from '../../../../constants/accumulationAddresses';
import { CENTER, ICONS } from '../../../../constants';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import ChainRow from './chainRow';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import useExpandAutoScroll from '../../../../hooks/useExpandAutoScroll';

export default function CreateAccumulationAddressDepositModal({
  setContentHeight,
  onShowQR,
  expandedChain,
  setExpandedChain,
}) {
  const { bottomPadding } = useGlobalInsets();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  const { scrollViewRef, handleRowLayout, onScroll, onLayout } =
    useExpandAutoScroll({
      expandedId: expandedChain,
      getPanelHeight: getChainExpandHeight,
    });

  const chainElements = useMemo(() => {
    return (
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={onLayout}
      >
        {[
          ...ACCUMULATION_CHAINS,
          { id: 'spark', label: 'Spark', assets: [] },
        ].map(chain => (
          <View
            key={chain.id}
            onLayout={e => handleRowLayout(chain.id, e.nativeEvent.layout.y)}
          >
            <ChainRow
              chain={chain}
              expanded={expandedChain === chain.id}
              disableExpand={chain.id === 'spark'}
              onToggleExpand={id => {
                if (chain.id === 'spark') {
                  setExpandedChain(null);
                  onShowQR({
                    selectedRecieveOption: 'spark',
                    fromStablecoin: true,
                  });
                } else {
                  setExpandedChain(prev => (prev === id ? null : id));
                }
              }}
              onSelectAsset={(c, asset) => {
                setExpandedChain(null);
                onShowQR({
                  selectedRecieveOption: 'Stablecoins',
                  sourceChain: c.id,
                  sourceAsset: asset,
                  destinationAsset: 'USDB',
                });
              }}
              isAssetTaken={() => false}
              onDisabledAssetPress={() => {}}
              theme={theme}
              darkModeType={darkModeType}
              backgroundColor={backgroundColor}
              backgroundOffset={backgroundOffset}
            />
          </View>
        ))}
      </ScrollView>
    );
  }, [
    expandedChain,
    theme,
    darkModeType,
    backgroundOffset,
    backgroundColor,
    onShowQR,
  ]);

  return <View style={styles.container}>{chainElements}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    ...CENTER,
  },
});
