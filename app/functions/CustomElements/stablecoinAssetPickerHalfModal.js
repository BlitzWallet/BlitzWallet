import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { CENTER, ICONS } from '../../constants';
import { INSET_WINDOW_WIDTH } from '../../constants/theme';
import ListCard from './redesign/ListCard';
import ListRow from './redesign/ListRow';
import { SheetTitle } from '../../components/admin/homeComponents/savings/savingsSheetParts';
import { useTranslation } from 'react-i18next';

const CHAIN_TO_FLASHNET = {
  Ethereum: 'ethereum',
  Arbitrum: 'arbitrum',
  Base: 'base',
  Optimism: 'optimism',
  Polygon: 'polygon',
  Tron: 'tron',
  Binance: 'bsc',
};

const USDT_SUPPORTED_CHAINS = new Set([
  'Ethereum',
  'Arbitrum',
  'Optimism',
  'Tron',
  'Polygon',
  'Binance',
]);

const USDC_SUPPORTED_CHAINS = new Set([
  'Ethereum',
  'Arbitrum',
  'Base',
  'Optimism',
  'Polygon',
  'Binance',
]);

const ASSETS = [
  {
    id: 'USDC',
    name: 'USDC',
    icon: ICONS.usdcLogo,
  },
  {
    id: 'USDT',
    name: 'USDT',
    icon: ICONS.usdtLogo,
  },
];

export default function StablecoinAssetPickerHalfModal({
  selectedChain,
  address,
  handleBackPressFunction,
  setContentHeight,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();

  useEffect(() => {
    setContentHeight(360);
  }, []);

  const handleAssetSelect = asset => {
    handleBackPressFunction(() => {
      navigate.replace('StablecoinSendScreen', {
        address,
        chain: CHAIN_TO_FLASHNET[selectedChain],
        chainLabel: selectedChain,
        asset,
      });
    });
  };

  return (
    <View style={styles.container}>
      <SheetTitle first title={t('wallet.stablecoinSend.assetPicker.header')} />
      <ListCard style={{ marginTop: 16 }}>
        {ASSETS.map(item => {
          const isUnsupported =
            (item.id === 'USDT' && !USDT_SUPPORTED_CHAINS.has(selectedChain)) ||
            (item.id === 'USDC' && !USDC_SUPPORTED_CHAINS.has(selectedChain));

          return (
            <View
              key={item.id}
              style={isUnsupported && styles.unsupported}
              pointerEvents={isUnsupported ? 'none' : 'auto'}
            >
              <ListRow
                onPress={
                  isUnsupported ? undefined : () => handleAssetSelect(item.id)
                }
                minHeight={64}
                lead={
                  <Image
                    style={styles.assetIcon}
                    source={item.icon}
                    contentFit="contain"
                  />
                }
                title={item.name}
                sub={
                  isUnsupported
                    ? t('wallet.stablecoinSend.assetPicker.notAvailable', {
                        chain: selectedChain,
                      })
                    : undefined
                }
                showChevron={!isUnsupported}
              />
            </View>
          );
        })}
      </ListCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    paddingBottom: 16,
  },
  unsupported: { opacity: 0.55 },
  assetIcon: {
    width: 40,
    height: 40,
  },
});
