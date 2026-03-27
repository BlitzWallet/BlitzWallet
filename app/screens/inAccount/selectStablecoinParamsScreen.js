import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useState, useCallback } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import GetThemeColors from '../../hooks/themeColors';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  FONT,
  ICONS,
  SIZES,
} from '../../constants';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { Image } from 'expo-image';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../../constants/theme';

const EVM_CHAINS = ['Base', 'Ethereum', 'Arbitrum', 'Optimism', 'Polygon'];
const TRON_ASSETS = [{ id: 'USDT', label: 'USDT', icon: ICONS.usdtLogo }];
const SOLANA_ASSETS = [{ id: 'USDC', label: 'USDC', icon: ICONS.usdcLogo }];

export default function SelectStablecoinParamsScreen() {
  const navigate = useNavigation();
  const route = useRoute();
  const { address, chainFamily } = route.params;
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { bottomPadding } = useGlobalInsets();

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

  const handleTronAssetSelect = useCallback(
    asset => {
      navigate.navigate('StablecoinSendScreen', {
        address,
        chain: 'tron',
        chainLabel: 'Tron',
        asset,
      });
    },
    [navigate, address],
  );

  const cardBg = backgroundOffset;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('wallet.stablecoinSend.sendStablecoins')}
        containerStyles={{ marginBottom: 0 }}
      />
      <ThemeText
        styles={styles.sectionTitle}
        content={t(
          isTron || isSolana
            ? 'wallet.stablecoinSend.selectAsset'
            : 'wallet.stablecoinSend.selectChain',
        )}
      />
      <View style={styles.innerContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPadding + 20 },
          ]}
        >
          <View style={styles.section}>
            <View style={styles.grid}>
              {isTron || isSolana
                ? (isTron ? TRON_ASSETS : SOLANA_ASSETS).map(asset => (
                    <TouchableOpacity
                      key={asset.id}
                      style={[
                        styles.card,
                        { backgroundColor: cardBg, borderColor: cardBg },
                      ]}
                      onPress={() => handleTronAssetSelect(asset.id)}
                      activeOpacity={0.7}
                    >
                      <Image
                        style={styles.cardIcon}
                        source={asset.icon}
                        contentFit="contain"
                      />
                      <ThemeText
                        styles={styles.cardLabel}
                        content={asset.label}
                      />
                    </TouchableOpacity>
                  ))
                : chains.map(chain => {
                    const isSelected = selectedChain === chain;
                    return (
                      <TouchableOpacity
                        key={chain}
                        style={[
                          styles.card,
                          { backgroundColor: cardBg, borderColor: cardBg },
                          isSelected && {
                            borderColor:
                              theme && darkModeType
                                ? COLORS.darkModeText
                                : COLORS.primary,
                          },
                        ]}
                        onPress={() => setSelectedChain(chain)}
                        activeOpacity={0.7}
                      >
                        <Image
                          style={styles.cardIcon}
                          source={ICONS[`chain_${chain.toLowerCase()}`]}
                          contentFit="contain"
                        />
                        <ThemeText styles={styles.cardLabel} content={chain} />
                      </TouchableOpacity>
                    );
                  })}
            </View>
          </View>
        </ScrollView>

        {!isTron && (
          <CustomButton
            textContent={t('constants.continue')}
            actionFunction={handleContinue}
            disabled={!selectedChain}
            buttonStyles={!selectedChain ? { opacity: 0.5 } : undefined}
          />
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scrollContent: {
    gap: 16,
    paddingTop: 8,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: SIZES.medium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    marginBottom: CONTENT_KEYBOARD_OFFSET,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    borderWidth: 1.5,
  },

  cardIcon: {
    width: 40,
    height: 40,
  },
  cardLabel: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Descriptoin_Medium,
    textAlign: 'center',
  },
});
