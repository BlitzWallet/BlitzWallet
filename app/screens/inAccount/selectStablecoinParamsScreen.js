import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import { useState, useCallback } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../functions/CustomElements/redesign/ListRow';
import PickRow from '../../functions/CustomElements/redesign/PickRow';
import Note from '../../functions/CustomElements/redesign/Note';
import { middleEllipsis } from '../../functions/CustomElements/redesign/KeyValueRow';
import useContentWidth from '../../functions/CustomElements/redesign/useContentWidth';
import GetThemeColors from '../../hooks/themeColors';
import { CENTER, ICONS } from '../../constants';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { Image } from 'expo-image';

const EVM_CHAINS = [
  'Base',
  'Ethereum',
  'Arbitrum',
  'Optimism',
  'Polygon',
  'Binance',
];
const TRON_ASSETS = [{ id: 'USDT', label: 'USDT', icon: ICONS.usdtLogo }];
const SOLANA_ASSETS = [
  { id: 'USDC', label: 'USDC', icon: ICONS.usdcLogo },
  { id: 'USDT', label: 'USDT', icon: ICONS.usdtLogo },
];

export default function SelectStablecoinParamsScreen() {
  const navigate = useNavigation();
  const route = useRoute();
  const { address, chainFamily, unsupportedTokenMessage } = route.params;
  const { t } = useTranslation();
  const { tokens } = GetThemeColors();
  const { bottomPadding } = useGlobalInsets();
  const contentWidth = useContentWidth();

  const isTron = chainFamily === 'Tron';
  const isSolana = chainFamily === 'Solana';
  const chains = isTron || isSolana ? [] : EVM_CHAINS;

  const [selectedChain, setSelectedChain] = useState(null);

  const handleContinue = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'stablecoinAssetPicker',
      selectedChain,
      address,
      sliderHight: 0.5,
    });
  }, [navigate, address, selectedChain]);

  const handleNonEvmAssetSelect = useCallback(
    asset => {
      navigate.navigate('StablecoinSendScreen', {
        address,
        chain: chainFamily.toLowerCase(),
        chainLabel: chainFamily,
        asset,
      });
    },
    [navigate, address],
  );

  const isNonEvm = isTron || isSolana;
  const shortAddress = middleEllipsis(address, 6, 4);

  return (
    <GlobalThemeView useStandardWidth={false}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t(
            isNonEvm
              ? 'wallet.stablecoinSend.selectAsset'
              : 'wallet.stablecoinSend.selectChain',
          )}
        />
        <ThemeText
          variant="body"
          styles={[styles.sub, { color: tokens.muted }]}
          content={
            isNonEvm
              ? t('wallet.stablecoinSend.sendingToOn', {
                  address: shortAddress,
                  chain: chainFamily,
                })
              : t('wallet.stablecoinSend.sendingTo', { address: shortAddress })
          }
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPadding + 20 },
          ]}
        >
          <ListCard>
            {isNonEvm
              ? (isTron ? TRON_ASSETS : SOLANA_ASSETS).map(asset => (
                  <ListRow
                    key={asset.id}
                    onPress={() => handleNonEvmAssetSelect(asset.id)}
                    lead={
                      <Image
                        style={styles.cardIcon}
                        source={asset.icon}
                        contentFit="contain"
                      />
                    }
                    title={asset.label}
                    showChevron
                  />
                ))
              : chains.map(chain => (
                  <PickRow
                    key={chain}
                    selected={selectedChain === chain}
                    onPress={() => setSelectedChain(chain)}
                    lead={
                      <Image
                        style={styles.cardIcon}
                        source={ICONS[`chain_${chain.toLowerCase()}`]}
                        contentFit="contain"
                      />
                    }
                    title={chain}
                  />
                ))}
          </ListCard>
        </CustomScrollView>

        {!!unsupportedTokenMessage && (
          <View style={styles.note}>
            <Note text={unsupportedTokenMessage} />
          </View>
        )}

        {!isTron && !isSolana && (
          <CustomButton
            size="regular"
            textContent={t('constants.continue')}
            actionFunction={handleContinue}
            disabled={!selectedChain}
            buttonStyles={[
              styles.button,
              !selectedChain ? { opacity: 0.5 } : undefined,
            ]}
          />
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  sub: { marginTop: 20, marginBottom: 16 },
  scrollContent: { flexGrow: 1 },
  note: { paddingVertical: 12, paddingHorizontal: 4 },
  button: { ...CENTER },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
