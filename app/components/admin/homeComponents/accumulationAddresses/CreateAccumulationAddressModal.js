import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import { useAccumulationAddresses } from '../../../../hooks/useAccumulationAddresses';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import {
  ACCUMULATION_CHAINS,
  ACCUMULATION_DESTINATIONS,
  getChainExpandHeight,
} from '../../../../constants/accumulationAddresses';
import { CENTER, ICONS } from '../../../../constants';
import { Image } from 'expo-image';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import ChainRow from './chainRow';
import useExpandAutoScroll from '../../../../hooks/useExpandAutoScroll';

// Steps: 'chain' | 'destination' | 'confirm'
const STEPS = ['chain', 'destination', 'confirm'];

export default function CreateAccumulationAddressModal({
  setContentHeight,
  handleBackPressFunction,
  forcedDestination,
  setBackNav,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textColor, backgroundColor } = GetThemeColors();
  const { addresses, createAddress } = useAccumulationAddresses();
  const { bottomPadding } = useGlobalInsets();

  const [step, setStep] = useState('chain');
  const [expandedChain, setExpandedChain] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedChain, setSelectedChain] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(
    forcedDestination || null,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [mountedSteps, setMountedSteps] = useState(() => new Set(['chain']));

  const isPairTaken = useCallback(
    (chainId, asset, dest) =>
      addresses.some(
        a =>
          a.sourceChain === chainId &&
          a.sourceAsset === asset &&
          a.destinationAsset === dest,
      ),
    [addresses],
  );

  const { scrollViewRef, handleRowLayout, onScroll, onLayout } =
    useExpandAutoScroll({
      expandedId: expandedChain,
      getPanelHeight: getChainExpandHeight,
    });

  const chainOpacity = useSharedValue(1);
  const chainTranslateX = useSharedValue(0);
  const destinationOpacity = useSharedValue(0);
  const destinationTranslateX = useSharedValue(30);
  const confirmOpacity = useSharedValue(0);
  const confirmTranslateX = useSharedValue(30);

  useEffect(() => {
    const activeIndex = STEPS.indexOf(step);
    const translateForStep = screenStep => {
      const screenIndex = STEPS.indexOf(screenStep);
      if (screenIndex === activeIndex) return 0;
      return screenIndex < activeIndex ? -30 : 30;
    };

    chainOpacity.value = withTiming(step === 'chain' ? 1 : 0, {
      duration: 250,
    });
    chainTranslateX.value = withTiming(translateForStep('chain'), {
      duration: 250,
    });
    destinationOpacity.value = withTiming(step === 'destination' ? 1 : 0, {
      duration: 250,
    });
    destinationTranslateX.value = withTiming(translateForStep('destination'), {
      duration: 250,
    });
    confirmOpacity.value = withTiming(step === 'confirm' ? 1 : 0, {
      duration: 250,
    });
    confirmTranslateX.value = withTiming(translateForStep('confirm'), {
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

  const confirmAnimatedStyle = useAnimatedStyle(() => ({
    opacity: confirmOpacity.value,
    transform: [{ translateX: confirmTranslateX.value }],
  }));

  const goToStep = useCallback(nextStep => {
    setMountedSteps(prev => {
      if (prev.has(nextStep)) return prev;
      const next = new Set(prev);
      next.add(nextStep);
      return next;
    });
    setStep(nextStep);
  }, []);

  useEffect(() => {
    setContentHeight(450);
  }, [step]);

  const handleBackPress = useCallback(() => {
    if (isCreating) return true;

    if (step === 'destination') {
      setSelectedDestination(null);
      goToStep('chain');
      return true;
    }

    if (step === 'confirm') {
      setSelectedDestination(forcedDestination || null);
      goToStep(forcedDestination ? 'chain' : 'destination');
      return true;
    }

    // 'chain' step — let the modal close naturally
    return false;
  }, [isCreating, step, forcedDestination, goToStep]);

  useHandleBackPressNew(handleBackPress);

  // Register the chrome's back arrow whenever past the first step.
  useEffect(() => {
    if (step === 'chain') {
      setBackNav?.(null);
    } else {
      setBackNav?.({
        onPress: handleBackPress,
        title:
          step === 'destination'
            ? t('screens.accumulationAddresses.create.pickDestination')
            : t('screens.accumulationAddresses.create.confirm'),
      });
    }
    return () => setBackNav?.(null);
  }, [step, handleBackPress, setBackNav]);

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    const result = await createAddress({
      sourceChain: selectedChain.id,
      sourceAsset: selectedAsset,
      destinationAsset: selectedDestination,
    });
    setIsCreating(false);
    if (result?.address || result?.error === 'already_exists') {
      handleBackPressFunction();
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

  return (
    <View style={styles.container}>
      {/* Chain step */}
      <Animated.View
        style={[styles.animatedContainer, chainAnimatedStyle]}
        pointerEvents={step === 'chain' ? 'auto' : 'none'}
      >
        <ThemeText
          styles={styles.stepTitle}
          content={t('screens.accumulationAddresses.create.pickChain')}
        />
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onLayout={onLayout}
        >
          {ACCUMULATION_CHAINS.map(chain => (
            <View
              key={chain.id}
              onLayout={e => handleRowLayout(chain.id, e.nativeEvent.layout.y)}
            >
              <ChainRow
                chain={chain}
                expanded={expandedChain === chain.id}
                onToggleExpand={id =>
                  setExpandedChain(prev => (prev === id ? null : id))
                }
                onSelectAsset={(c, asset) => {
                  setSelectedChain(c);
                  setSelectedAsset(asset);
                  goToStep(forcedDestination ? 'confirm' : 'destination');
                  setExpandedChain(null);
                }}
                isAssetTaken={
                  forcedDestination
                    ? asset => isPairTaken(chain.id, asset, forcedDestination)
                    : () => false
                }
                onDisabledAssetPress={() =>
                  navigate.navigate('ErrorScreen', {
                    errorMessage: t(
                      'screens.accumulationAddresses.create.alreadyExists',
                    ),
                  })
                }
                theme={theme}
                darkModeType={darkModeType}
                backgroundColor={backgroundColor}
                backgroundOffset={backgroundOffset}
              />
            </View>
          ))}
        </ScrollView>
      </Animated.View>

      {mountedSteps.has('destination') && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.animatedContainer,
            destinationAnimatedStyle,
          ]}
          pointerEvents={step === 'destination' ? 'auto' : 'none'}
        >
          {ACCUMULATION_DESTINATIONS.map(dest => {
            const taken = isPairTaken(selectedChain?.id, selectedAsset, dest);
            return (
              <TouchableOpacity
                key={dest}
                activeOpacity={taken ? HIDDEN_OPACITY : 0.2}
                style={[
                  styles.optionRow,
                  { opacity: taken ? HIDDEN_OPACITY : 1 },
                ]}
                onPress={() => {
                  if (taken) {
                    navigate.navigate('ErrorScreen', {
                      errorMessage: t(
                        'screens.accumulationAddresses.create.alreadyExists',
                      ),
                    });
                    return;
                  }
                  setSelectedDestination(dest);
                  goToStep('confirm');
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
                  styles={styles.optionLabel}
                  content={
                    dest === 'BTC'
                      ? t('constants.bitcoin_upper')
                      : t('constants.dollars_upper')
                  }
                />
                <ThemeIcon iconName="ChevronRight" size={18} />
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      )}

      {mountedSteps.has('confirm') && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.animatedContainer,
            confirmAnimatedStyle,
          ]}
          pointerEvents={step === 'confirm' ? 'auto' : 'none'}
        >
          <View style={styles.confirmContent}>
            <View style={styles.assetRow}>
              <View style={styles.confirmIconWrapper}>
                <View
                  style={[
                    styles.confirmChainCircle,
                    { backgroundColor: backgroundOffset },
                  ]}
                >
                  <Image
                    style={styles.confirmChainIcon}
                    source={
                      ICONS[`chain_${selectedChain?.label.toLowerCase()}`]
                    }
                    contentFit="contain"
                  />
                </View>
                <View
                  style={[
                    styles.confirmCurrencyBadge,
                    { borderColor: backgroundColor },
                  ]}
                >
                  <Image
                    style={styles.confirmCurrencyIcon}
                    source={ICONS[`${selectedAsset?.toLowerCase()}Logo`]}
                    contentFit="contain"
                  />
                </View>
              </View>
              <ThemeIcon styles={{ opacity: 0.7 }} iconName={'ArrowRight'} />
              <View style={styles.confirmIconWrapper}>
                <View
                  style={[
                    styles.confirmChainCircle,
                    {
                      backgroundColor:
                        theme && darkModeType
                          ? backgroundColor
                          : selectedDestination === 'BTC'
                          ? COLORS.bitcoinOrange
                          : COLORS.dollarGreen,
                    },
                  ]}
                >
                  <Image
                    style={[styles.confirmChainIcon, { width: 50, height: 50 }]}
                    source={
                      ICONS[
                        selectedDestination === 'BTC'
                          ? 'bitcoinIcon'
                          : 'dollarIcon'
                      ]
                    }
                    contentFit="contain"
                  />
                </View>
              </View>
            </View>

            <ThemeText
              styles={styles.confirmChainName}
              content={selectedChain?.label}
            />
            <ThemeText
              styles={styles.confirmSubtitle}
              content={t('screens.accumulationAddresses.create.convertDesc', {
                chain: selectedChain?.label,
                asset: selectedAsset,
                receiveCurrency:
                  selectedDestination === 'BTC'
                    ? t('constants.bitcoin_upper')
                    : t('constants.dollars_upper'),
              })}
            />
          </View>

          <CustomButton
            buttonStyles={[styles.createBtn, { marginBottom: bottomPadding }]}
            textContent={t('screens.accumulationAddresses.summary.create')}
            actionFunction={handleCreate}
            useLoading={isCreating}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  animatedContainer: {
    flex: 1,
    width: '100%',
  },
  stepTitle: {
    fontSize: SIZES.large,
    fontWeight: 500,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingBottom: 16,
    gap: 10,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  confirmContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmIconWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  confirmChainCircle: {
    width: 80,
    height: 80,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  confirmChainIcon: {
    width: 80,
    height: 80,
  },
  confirmCurrencyBadge: {
    position: 'absolute',
    width: 25,
    height: 25,
    borderRadius: 15,
    bottom: -4,
    right: -4,
    borderWidth: 2,
    overflow: 'hidden',
  },
  confirmCurrencyIcon: {
    width: '100%',
    height: '100%',
  },
  confirmChainName: {
    fontSize: SIZES.large,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 6,
    includeFontPadding: false,
  },
  confirmSubtitle: {
    maxWidth: 250,
    width: '90%',
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
  },
  createBtn: { width: 'auto', ...CENTER },
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
