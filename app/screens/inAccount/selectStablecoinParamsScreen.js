import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useState, useCallback } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import GetThemeColors from '../../hooks/themeColors';
import { CENTER, COLORS, FONT, SIZES } from '../../constants';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useGlobalInsets } from '../../../context-store/insetsProvider';

const EVM_CHAINS = ['Base', 'Ethereum', 'Arbitrum', 'Optimism', 'Polygon'];
const USDT_CHAINS = new Set(['Ethereum', 'Arbitrum', 'Optimism', 'Tron']);

const CHAIN_TO_FLASHNET = {
  Ethereum: 'ethereum',
  Arbitrum: 'arbitrum',
  Base: 'base',
  Optimism: 'optimism',
  Polygon: 'polygon',
  Solana: 'solana',
  Tron: 'tron',
};

function truncateAddress(addr) {
  if (!addr) return '';
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

export default function SelectStablecoinParamsScreen() {
  const navigate = useNavigation();
  const route = useRoute();
  const { address, chainFamily } = route.params;
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { bottomPadding } = useGlobalInsets();

  const defaultChain =
    chainFamily === 'EVM' ? 'Base' : chainFamily === 'Tron' ? 'Tron' : 'Solana';

  const [selectedChain, setSelectedChain] = useState(defaultChain);
  const [selectedAsset, setSelectedAsset] = useState('USDC');

  const isUSDTSupported = USDT_CHAINS.has(selectedChain);

  const handleChainSelect = useCallback(
    chain => {
      setSelectedChain(chain);
      if (!USDT_CHAINS.has(chain) && selectedAsset === 'USDT') {
        setSelectedAsset('USDC');
      }
    },
    [selectedAsset],
  );

  const handleContinue = useCallback(() => {
    navigate.navigate('StablecoinSendScreen', {
      address,
      chain: CHAIN_TO_FLASHNET[selectedChain],
      chainLabel: selectedChain,
      asset: selectedAsset,
    });
  }, [navigate, address, selectedChain, selectedAsset]);

  const rowBg = theme && darkModeType ? backgroundColor : backgroundOffset;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('wallet.stablecoinSend.sendStablecoins')}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPadding + 20 },
        ]}
      >
        {/* Recipient address */}
        <View style={[styles.addressRow, { backgroundColor: rowBg }]}>
          <ThemeText
            styles={styles.addressLabel}
            content={t('wallet.stablecoinSend.recipient')}
          />
          <ThemeText
            styles={styles.addressValue}
            content={truncateAddress(address)}
          />
        </View>

        {/* Chain selector — only for EVM (same 0x address on all chains) */}
        {chainFamily === 'EVM' && (
          <View style={styles.section}>
            <ThemeText
              styles={styles.sectionTitle}
              content={t('wallet.stablecoinSend.selectChain')}
            />
            {EVM_CHAINS.map(chain => (
              <TouchableOpacity
                key={chain}
                style={[
                  styles.optionRow,
                  { backgroundColor: rowBg },
                  selectedChain === chain && styles.optionRowSelected,
                ]}
                onPress={() => handleChainSelect(chain)}
                activeOpacity={0.7}
              >
                <ThemeText styles={styles.optionLabel} content={chain} />
                <View
                  style={[
                    styles.radio,
                    selectedChain === chain && {
                      borderColor: COLORS.primary,
                      backgroundColor: COLORS.primary,
                    },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Static chain display for non-EVM */}
        {chainFamily !== 'EVM' && (
          <View style={styles.section}>
            <ThemeText
              styles={styles.sectionTitle}
              content={t('wallet.stablecoinSend.network')}
            />
            <View style={[styles.optionRow, { backgroundColor: rowBg }]}>
              <ThemeText styles={styles.optionLabel} content={defaultChain} />
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: COLORS.primary,
                    backgroundColor: COLORS.primary,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Asset selector */}
        <View style={styles.section}>
          <ThemeText
            styles={styles.sectionTitle}
            content={t('wallet.stablecoinSend.selectAsset')}
          />
          {['USDC', 'USDT'].map(asset => {
            const disabled = asset === 'USDT' && !isUSDTSupported;
            return (
              <TouchableOpacity
                key={asset}
                style={[
                  styles.optionRow,
                  { backgroundColor: rowBg },
                  selectedAsset === asset && styles.optionRowSelected,
                  disabled && styles.optionRowDisabled,
                ]}
                onPress={() => !disabled && setSelectedAsset(asset)}
                activeOpacity={disabled ? 1 : 0.7}
              >
                <ThemeText
                  styles={[styles.optionLabel, disabled && styles.disabledText]}
                  content={asset}
                />
                {disabled && (
                  <ThemeText
                    styles={styles.disabledHint}
                    content={t(
                      'wallet.stablecoinSend.chainNotSupportedForAsset',
                    )}
                  />
                )}
                <View
                  style={[
                    styles.radio,
                    !disabled &&
                      selectedAsset === asset && {
                        borderColor: COLORS.primary,
                        backgroundColor: COLORS.primary,
                      },
                    disabled && styles.radioDisabled,
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <CustomButton
        textContent={t('constants.continue')}
        actionFunction={handleContinue}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: 16,
    paddingTop: 8,
  },
  addressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  addressLabel: {
    fontSize: SIZES.medium,
    opacity: 0.65,
  },
  addressValue: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Descriptoin_Medium,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Descriptoin_Medium,
    opacity: 0.65,
    marginBottom: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  optionRowSelected: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  optionRowDisabled: {
    opacity: 0.45,
  },
  optionLabel: {
    flex: 1,
    fontSize: SIZES.medium,
    fontFamily: FONT.Descriptoin_Medium,
  },
  disabledText: {
    opacity: 0.5,
  },
  disabledHint: {
    fontSize: SIZES.small,
    opacity: 0.5,
    marginRight: 8,
    textAlign: 'right',
    flex: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#888',
    backgroundColor: 'transparent',
  },
  radioDisabled: {
    borderColor: '#ccc',
  },
});
