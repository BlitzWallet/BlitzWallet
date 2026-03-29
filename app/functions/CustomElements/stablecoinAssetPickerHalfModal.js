import { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { ThemeText } from '.';
import GetThemeColors from '../../hooks/themeColors';
import { ICONS, SIZES } from '../../constants';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { ChevronRight } from 'lucide-react-native';
import { HIDDEN_OPACITY } from '../../constants/theme';
import { useTranslation } from 'react-i18next';

const CHAIN_TO_FLASHNET = {
  Ethereum: 'ethereum',
  Arbitrum: 'arbitrum',
  Base: 'base',
  Optimism: 'optimism',
  Polygon: 'polygon',
  Tron: 'tron',
};

const USDT_SUPPORTED_CHAINS = new Set([
  'Ethereum',
  'Arbitrum',
  'Optimism',
  'Tron',
]);

const USDC_SUPPORTED_CHAINS = new Set([
  'Ethereum',
  'Arbitrum',
  'Base',
  'Optimism',
  'Polygon',
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
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();

  useEffect(() => {
    setContentHeight(400);
  }, []);

  const rowBg = theme && darkModeType ? backgroundColor : backgroundOffset;

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
      <ThemeText
        styles={styles.title}
        content={t('wallet.stablecoinSend.assetPicker.header')}
      />

      {ASSETS.map(item => {
        const isUnsupported =
          (item.id === 'USDT' && !USDT_SUPPORTED_CHAINS.has(selectedChain)) ||
          (item.id === 'USDC' && !USDC_SUPPORTED_CHAINS.has(selectedChain));

        const rowContent = (
          <>
            <Image
              style={styles.assetIcon}
              source={item.icon}
              contentFit="contain"
            />
            <View style={styles.assetInfo}>
              <ThemeText styles={styles.assetName} content={item.name} />
              {isUnsupported && (
                <ThemeText
                  styles={styles.unsupportedLabel}
                  content={t('wallet.stablecoinSend.assetPicker.notAvailable', {
                    chain: selectedChain,
                  })}
                />
              )}
            </View>
            {!isUnsupported && (
              <ChevronRight
                size={20}
                color={textColor}
                style={{ opacity: 0.5 }}
              />
            )}
          </>
        );

        if (isUnsupported) {
          return (
            <View
              key={item.id}
              style={[styles.row, { backgroundColor: rowBg, opacity: 0.4 }]}
              pointerEvents="none"
            >
              {rowContent}
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.row, { backgroundColor: rowBg }]}
            onPress={() => handleAssetSelect(item.id)}
            activeOpacity={0.7}
          >
            {rowContent}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: 500,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  assetIcon: {
    width: 40,
    height: 40,
  },
  assetInfo: {
    flex: 1,
    gap: 2,
  },
  assetName: {
    fontSize: SIZES.large,
    fontWeight: 500,
  },

  unsupportedLabel: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
  },
});
