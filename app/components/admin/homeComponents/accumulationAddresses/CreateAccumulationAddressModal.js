import { useCallback, useEffect, useRef, useState } from 'react';
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
import { scheduleOnRN } from 'react-native-worklets';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';

// Steps: 'chain' | 'destination' | 'confirm'
const STEPS = ['chain', 'destination', 'confirm'];

export default function CreateAccumulationAddressModal({
  setContentHeight,
  handleBackPressFunction,
  forcedDestination,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textColor, backgroundColor } = GetThemeColors();
  const { addresses, createAddress } = useAccumulationAddresses();
  const { bottomPadding } = useGlobalInsets();

  const [step, setStep] = useState('chain');
  const [renderedStep, setRenderedStep] = useState('chain');
  const renderedStepRef = useRef('chain');
  const [expandedChain, setExpandedChain] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedChain, setSelectedChain] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(
    forcedDestination || null,
  );
  const [isCreating, setIsCreating] = useState(false);

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

  const pageOpacity = useSharedValue(1);
  const pageTranslateX = useSharedValue(0);

  const startInAnimation = useCallback(
    (newStep, goingForward) => {
      renderedStepRef.current = newStep;
      setRenderedStep(newStep);
      pageTranslateX.value = goingForward ? 30 : -30;
      pageOpacity.value = withTiming(1, { duration: 125 });
      pageTranslateX.value = withTiming(0, { duration: 125 });
    },
    [pageTranslateX, pageOpacity],
  );

  useEffect(() => {
    if (step === renderedStepRef.current) return;
    const goingForward =
      STEPS.indexOf(step) > STEPS.indexOf(renderedStepRef.current);
    pageOpacity.value = withTiming(0, { duration: 125 });
    pageTranslateX.value = withTiming(
      goingForward ? -30 : 30,
      { duration: 125 },
      finished => {
        if (finished) scheduleOnRN(startInAnimation, step, goingForward);
      },
    );
  }, [step]);

  const pageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pageOpacity.value,
    transform: [{ translateX: pageTranslateX.value }],
  }));

  useEffect(() => {
    setContentHeight(450);
  }, [step]);

  const handleBackPress = useCallback(() => {
    if (isCreating) return true;

    if (step === 'destination') {
      setSelectedDestination(null);
      setStep('chain');
      return true;
    }

    if (step === 'confirm') {
      setSelectedDestination(forcedDestination || null);
      setStep(forcedDestination ? 'chain' : 'destination');
      return true;
    }

    // 'chain' step — let the modal close naturally
    return false;
  }, [isCreating, step, forcedDestination]);

  useHandleBackPressNew(handleBackPress);

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

  // ── Chain step ──────────────────────────────────────────────────────────────
  if (renderedStep === 'chain') {
    return (
      <Animated.View style={[styles.container, pageAnimatedStyle]}>
        <ThemeText
          styles={styles.stepTitle}
          content={t('screens.accumulationAddresses.create.pickChain')}
        />
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
                setStep(forcedDestination ? 'confirm' : 'destination');
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
          ))}
        </ScrollView>
      </Animated.View>
    );
  }

  // ── Destination step ────────────────────────────────────────────────────────
  if (renderedStep === 'destination') {
    return (
      <Animated.View style={[styles.container, pageAnimatedStyle]}>
        <ThemeText
          styles={styles.stepTitle}
          content={t('screens.accumulationAddresses.create.pickDestination')}
        />
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
    );
  }

  // ── Confirm step ────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.container, pageAnimatedStyle]}>
      <ThemeText
        styles={styles.stepTitle}
        content={t('screens.accumulationAddresses.create.confirm')}
      />

      <View style={styles.confirmContent}>
        <View style={styles.confirmIconWrapper}>
          <View
            style={[
              styles.confirmChainCircle,
              { backgroundColor: backgroundOffset },
            ]}
          >
            <Image
              style={styles.confirmChainIcon}
              source={ICONS[`chain_${selectedChain?.label.toLowerCase()}`]}
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

        <ThemeText
          styles={styles.confirmChainName}
          content={selectedChain?.label}
        />
        <ThemeText
          styles={styles.confirmSubtitle}
          content={`${selectedAsset} → ${
            selectedDestination === 'BTC'
              ? t('constants.bitcoin_upper')
              : t('constants.dollars_upper')
          }`}
        />
      </View>

      <CustomButton
        buttonStyles={[styles.createBtn, { marginBottom: bottomPadding }]}
        textContent={t('screens.accumulationAddresses.summary.create')}
        actionFunction={handleCreate}
        useLoading={isCreating}
      />
    </Animated.View>
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
    height: expandHeight.value * (chain.assets.length * 65 + 16),
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
        <View style={{ opacity: HIDDEN_OPACITY }}>
          <Animated.View style={chevronStyle}>
            <ThemeIcon iconName="ChevronDown" size={18} />
          </Animated.View>
        </View>
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
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  stepTitle: {
    fontSize: SIZES.large,
    fontWeight: 500,
    marginBottom: 8,
  },
  chainRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
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
    paddingVertical: 10,
    marginBottom: 8,
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
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  confirmChainIcon: {
    width: 90,
    height: 90,
  },
  confirmCurrencyBadge: {
    position: 'absolute',
    width: 30,
    height: 30,
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
