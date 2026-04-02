import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import { useAccumulationAddresses } from '../../../../hooks/useAccumulationAddresses';
import {
  COLORS,
  FONT,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import {
  ACCUMULATION_CHAINS,
  ACCUMULATION_DESTINATIONS,
} from '../../../../constants/accumulationAddresses';
import { CENTER, ICONS } from '../../../../constants';
import { Image } from 'expo-image';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import ThemeImage from '../../../../functions/CustomElements/themeImage';

// Steps: 'asset' | 'chain' | 'destination' | 'confirm'

export default function CreateAccumulationAddressModal({
  setContentHeight,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textColor, backgroundColor } = GetThemeColors();
  const { addresses, createAddress } = useAccumulationAddresses();

  const [step, setStep] = useState('asset');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedChain, setSelectedChain] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setContentHeight(420);
  }, [step]);

  // Chains available for the selected asset
  const availableChains = selectedAsset
    ? ACCUMULATION_CHAINS.filter(c => c.assets.includes(selectedAsset))
    : [];

  // A chain is disabled if ALL destination combos for the *selected asset* on that chain already exist
  const isChainDisabled = useCallback(
    chain => {
      if (!selectedAsset) return false;
      return ACCUMULATION_DESTINATIONS.every(dest =>
        addresses.some(
          a =>
            a.sourceChain === chain.id &&
            a.sourceAsset === selectedAsset &&
            a.destinationAsset === dest,
        ),
      );
    },
    [addresses, selectedAsset],
  );

  // Check if a destination is already taken for selected chain+asset
  const isDestinationTaken = useCallback(
    dest => {
      if (!selectedChain || !selectedAsset) return false;
      return addresses.some(
        a =>
          a.sourceChain === selectedChain.id &&
          a.sourceAsset === selectedAsset &&
          a.destinationAsset === dest,
      );
    },
    [addresses, selectedChain, selectedAsset],
  );

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    const result = await createAddress({
      sourceChain: selectedChain.id,
      sourceAsset: selectedAsset,
      destinationAsset: selectedDestination,
    });
    setIsCreating(false);
    if (result?.address) {
      handleBackPressFunction();
    } else if (result?.error === 'already_exists') {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.accumulationAddresses.create.alreadyExists'),
      });
    } else {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.accumulationAddresses.errors.createFailed'),
      });
    }
  }, [
    createAddress,
    selectedChain,
    selectedAsset,
    selectedDestination,
    handleBackPressFunction,
    navigate,
    t,
  ]);

  // ── Asset step ──────────────────────────────────────────────────────────────
  if (step === 'asset') {
    return (
      <View style={styles.container}>
        <ThemeText
          styles={styles.stepTitle}
          content={t('screens.accumulationAddresses.create.pickAsset')}
        />
        {['USDC', 'USDT'].map(asset => (
          <TouchableOpacity
            key={asset}
            activeOpacity={0.7}
            style={styles.optionRow}
            onPress={() => {
              setSelectedAsset(asset);
              setStep('chain');
            }}
          >
            <Image
              style={styles.assetIcon}
              source={ICONS[`${asset.toLocaleLowerCase()}Logo`]}
              contentFit="contain"
            />

            <ThemeText styles={styles.optionLabel} content={asset} />
            <ThemeIcon iconName="ChevronRight" size={18} />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // ── Chain step ──────────────────────────────────────────────────────────────
  if (step === 'chain') {
    return (
      <View style={styles.container}>
        <ThemeText
          styles={styles.stepTitle}
          content={t('screens.accumulationAddresses.create.pickChain')}
        />
        <ScrollView showsVerticalScrollIndicator={false}>
          {availableChains.map(chain => {
            const disabled = isChainDisabled(chain);
            return (
              <TouchableOpacity
                key={chain.id}
                activeOpacity={disabled ? 1 : 0.7}
                style={[styles.optionRow, disabled && styles.disabledRow]}
                onPress={() => {
                  if (disabled) return;
                  setSelectedChain(chain);
                  setStep('destination');
                }}
              >
                <Image
                  style={styles.assetIcon}
                  source={ICONS[`chain_${chain.label.toLocaleLowerCase()}`]}
                  contentFit="contain"
                />
                <ThemeText
                  styles={[styles.optionLabel, disabled && styles.disabledText]}
                  content={chain.label}
                />
                <ThemeIcon iconName="ChevronRight" size={18} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // ── Destination step ────────────────────────────────────────────────────────
  if (step === 'destination') {
    return (
      <View style={styles.container}>
        <ThemeText
          styles={styles.stepTitle}
          content={t('screens.accumulationAddresses.create.pickDestination')}
        />
        {ACCUMULATION_DESTINATIONS.map(dest => {
          const taken = isDestinationTaken(dest);
          return (
            <View key={dest}>
              <TouchableOpacity
                activeOpacity={taken ? 1 : 0.7}
                style={[styles.optionRow, taken && styles.disabledRow]}
                onPress={() => {
                  if (taken) return;
                  setSelectedDestination(dest);
                  setStep('confirm');
                }}
              >
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor:
                        theme && darkModeType
                          ? darkModeType
                            ? backgroundColor
                            : backgroundOffset
                          : dest === 'BTC'
                          ? COLORS.bitcoinOrange
                          : COLORS.dollarGreen,
                    },
                  ]}
                >
                  <ThemeImage
                    styles={{ width: 25, height: 25 }}
                    lightModeIcon={
                      dest === 'BTC' ? ICONS.bitcoinIcon : ICONS.dollarIcon
                    }
                    darkModeIcon={
                      dest === 'BTC' ? ICONS.bitcoinIcon : ICONS.dollarIcon
                    }
                    lightsOutIcon={
                      dest === 'BTC' ? ICONS.bitcoinIcon : ICONS.dollarIcon
                    }
                  />
                </View>
                <ThemeText
                  styles={[styles.optionLabel, taken && styles.disabledText]}
                  content={
                    dest === 'BTC'
                      ? t('constants.bitcoin_upper')
                      : t('constants.dollars_upper')
                  }
                />
                <ThemeIcon iconName="ChevronRight" size={18} />
              </TouchableOpacity>
              {taken && (
                <ThemeText
                  styles={styles.takenNote}
                  content={t(
                    'screens.accumulationAddresses.create.alreadyExists',
                  )}
                />
              )}
            </View>
          );
        })}
      </View>
    );
  }

  // ── Confirm step ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.stepTitle}
        content={t('screens.accumulationAddresses.create.confirm')}
      />

      <View style={[styles.summaryCard, { backgroundColor: backgroundOffset }]}>
        <SummaryRow
          label={t('screens.accumulationAddresses.summary.chain')}
          value={selectedChain?.label}
        />
        <SummaryRow
          label={t('screens.accumulationAddresses.summary.paymentCurrency')}
          value={selectedAsset}
        />
        <SummaryRow
          label={t('screens.accumulationAddresses.summary.destination')}
          value={
            selectedDestination === 'BTC'
              ? t('constants.bitcoin_upper')
              : t('constants.dollars_upper')
          }
        />
      </View>

      <CustomButton
        buttonStyles={styles.createBtn}
        textContent={t('screens.accumulationAddresses.summary.create')}
        actionFunction={handleCreate}
        useLoading={isCreating}
      />
    </View>
  );
}

function SummaryRow({ label, value }) {
  return (
    <View style={styles.summaryRow}>
      <ThemeText styles={styles.summaryLabel} content={label} />
      <ThemeText styles={styles.summaryValue} content={value ?? ''} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: SIZES.large,
    fontWeight: 500,
    marginBottom: 8,
  },
  headerSpacer: { width: 22 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    // paddingHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  optionLabel: {
    flex: 1,
    fontSize: SIZES.large,
    fontWeight: 500,
    includeFontPadding: false,
  },
  disabledRow: { opacity: 0.4 },
  disabledText: {},
  takenNote: {
    fontSize: SIZES.small,
    opacity: 0.6,
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 'auto',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: { opacity: 0.7 },
  summaryValue: { fontWeight: 500 },
  createBtn: { width: 'auto', ...CENTER },
  assetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
