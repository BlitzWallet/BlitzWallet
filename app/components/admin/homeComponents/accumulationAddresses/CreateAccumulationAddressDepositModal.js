import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import GetThemeColors from '../../../../hooks/themeColors';

import { ACCUMULATION_CHAINS } from '../../../../constants/accumulationAddresses';
import { CENTER, ICONS } from '../../../../constants';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import ChainRow from './chainRow';

export default function CreateAccumulationAddressDepositModal({
  setContentHeight,
  onShowQR,
  expandedChain,
  setExpandedChain,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  const chainElements = useMemo(() => {
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {ACCUMULATION_CHAINS.map(chain => (
          <ChainRow
            key={chain.id}
            chain={chain}
            expanded={expandedChain === chain.id}
            onToggleExpand={id =>
              setExpandedChain(prev => (prev === id ? null : id))
            }
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
