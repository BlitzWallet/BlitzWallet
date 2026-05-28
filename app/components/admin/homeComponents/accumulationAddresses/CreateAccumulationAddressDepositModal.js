import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import GetThemeColors from '../../../../hooks/themeColors';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { COLORS, HIDDEN_OPACITY, SIZES } from '../../../../constants/theme';
import {
  ACCUMULATION_CHAINS,
  ACCUMULATION_DESTINATIONS,
} from '../../../../constants/accumulationAddresses';
import { CENTER, ICONS } from '../../../../constants';
import { Image } from 'expo-image';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

export default function CreateAccumulationAddressDepositModal({
  setContentHeight,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  const [step, setStep] = useState('chain');
  const [expandedChain, setExpandedChain] = useState(null);
  const [selectedChain, setSelectedChain] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const chainOpacity = useSharedValue(1);
  const chainTranslateX = useSharedValue(0);
  const destinationOpacity = useSharedValue(0);
  const destinationTranslateX = useSharedValue(30);

  useEffect(() => {
    const showChain = step === 'chain';
    chainOpacity.value = withTiming(showChain ? 1 : 0, { duration: 250 });
    chainTranslateX.value = withTiming(showChain ? 0 : -30, { duration: 250 });
    destinationOpacity.value = withTiming(showChain ? 0 : 1, { duration: 250 });
    destinationTranslateX.value = withTiming(showChain ? 30 : 0, {
      duration: 250,
    });
  }, [step]);

  const chainAnimatedStyle = useAnimatedStyle(() => ({
    opacity: chainOpacity.value,
    transform: [{ translateX: chainTranslateX.value }],
  }));

  const destinationAnimatedStyle = useAnimatedStyle(() => ({
    opacity: destinationOpacity.value,
    transform: [{ translateX: destinationTranslateX.value }],
  }));

  const handleBackPress = useCallback(() => {
    if (step === 'destination') {
      setStep('chain');
      return true;
    }
    setExpandedChain(null);
    return false;
  }, [step]);

  useHandleBackPressNew(handleBackPress);

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
              setSelectedChain(c);
              setSelectedAsset(asset);
              setStep('destination');
              setExpandedChain(null);
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
  }, [expandedChain, theme, darkModeType, backgroundOffset, backgroundColor]);

  return (
    <View style={styles.container}>
      {/* Chain step — always mounted, base layer */}
      <Animated.View
        style={[styles.stepContainer, chainAnimatedStyle]}
        pointerEvents={step === 'chain' ? 'auto' : 'none'}
      >
        <ThemeText
          styles={styles.stepTitle}
          content={t('screens.accumulationAddresses.create.pickChain')}
        />
        {chainElements}
      </Animated.View>

      {/* Destination step — always mounted, stacked absolutely */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.stepContainer,
          {
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          },
          destinationAnimatedStyle,
        ]}
        pointerEvents={step === 'destination' ? 'auto' : 'none'}
      >
        <ThemeText
          styles={styles.stepTitle}
          content={t('screens.accumulationAddresses.create.pickDestination')}
        />
        {ACCUMULATION_DESTINATIONS.map(dest => (
          <TouchableOpacity
            key={dest ?? 'dollars'}
            activeOpacity={0.2}
            style={styles.optionRow}
            onPress={() =>
              handleBackPressFunction(() => {
                const isOnReceivePage = navigate
                  .getState()
                  .routes.some(r => r.name === 'ReceiveBTC');
                if (isOnReceivePage) {
                  navigate.popTo('ReceiveBTC', {
                    selectedRecieveOption: 'Stablecoins',
                    sourceChain: selectedChain.id,
                    sourceAsset: selectedAsset,
                    destinationAsset: dest,
                  });
                } else {
                  navigate.replace('ReceiveBTC', {
                    selectedRecieveOption: 'Stablecoins',
                    sourceChain: selectedChain.id,
                    sourceAsset: selectedAsset,
                    destinationAsset: dest,
                  });
                }
              })
            }
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
              styles={styles.optionLabel}
              content={
                dest === 'BTC'
                  ? t('constants.bitcoin_upper')
                  : t('constants.dollars_upper')
              }
            />
            <View style={{ opacity: HIDDEN_OPACITY }}>
              <ThemeIcon iconName="ChevronRight" size={18} />
            </View>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
}

function ChainRow({
  chain,
  expanded,
  onToggleExpand,
  onSelectAsset,
  isAssetTaken,
  onDisabledAssetPress,
  theme,
  darkModeType,
  backgroundColor,
  backgroundOffset,
}) {
  const expandHeight = useSharedValue(0);
  const chevronRotation = useSharedValue(0);

  useEffect(() => {
    expandHeight.value = withTiming(expanded ? 1 : 0, { duration: 200 });
    chevronRotation.value = withTiming(expanded ? 1 : 0, { duration: 200 });
  }, [expanded]);

  const expandedStyle = useAnimatedStyle(() => ({
    height: expandHeight.value * (chain.assets.length * 65 + 26),
    opacity: expandHeight.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
  }));

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.chainRow}
        onPress={() => onToggleExpand(chain.id)}
      >
        <View
          style={[
            styles.chainIconContainer,
            {
              backgroundColor:
                theme && darkModeType ? backgroundColor : backgroundOffset,
            },
          ]}
        >
          <Image
            style={styles.assetIcon}
            source={ICONS[`chain_${chain.label.toLowerCase()}`]}
            contentFit="contain"
          />
        </View>
        <ThemeText styles={styles.optionLabel} content={chain.label} />

        <Animated.View style={[{ opacity: HIDDEN_OPACITY }, chevronStyle]}>
          <ThemeIcon iconName="ChevronDown" size={18} />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={[styles.assetOptionsContainer, expandedStyle]}>
        {chain.assets.map(asset => {
          const disabled = isAssetTaken(asset);
          return (
            <TouchableOpacity
              key={asset}
              activeOpacity={0.7}
              style={[
                styles.assetOptionRow,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                  opacity: disabled ? HIDDEN_OPACITY : 1,
                },
              ]}
              onPress={() =>
                disabled ? onDisabledAssetPress() : onSelectAsset(chain, asset)
              }
            >
              <View style={styles.assetOptionIconContainer}>
                <Image
                  style={styles.assetOptionIcon}
                  source={ICONS[`${asset.toLowerCase()}Logo`]}
                  contentFit="contain"
                />
              </View>
              <ThemeText styles={styles.optionLabel} content={asset} />
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    ...CENTER,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: SIZES.large,
    fontWeight: 500,
    marginBottom: 16,
    includeFontPadding: false,
  },
  chainRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    // paddingVertical: 8,
  },
  chainIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 8,
    paddingBottom: 8,
    gap: 10,
  },
  optionLabel: {
    flex: 1,
    includeFontPadding: false,
  },
  iconContainer: {
    width: 45,
    height: 45,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetIcon: {
    width: 45,
    height: 45,
  },
  assetOptionsContainer: {
    overflow: 'hidden',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  assetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 12,
  },
  assetOptionIconContainer: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetOptionIcon: {
    width: 35,
    height: 35,
  },
});
