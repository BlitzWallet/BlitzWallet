import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import { useAccumulationAddresses } from '../../../../hooks/useAccumulationAddresses';
import { FONT, INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import {
  ACCUMULATION_CHAINS,
  ACCUMULATION_DESTINATIONS,
  getChainExpandHeight,
  getAccumulationAddressLimit,
} from '../../../../constants/accumulationAddresses';
import { CENTER } from '../../../../constants';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import ChainRow from './chainRow';
import useExpandAutoScroll from '../../../../hooks/useExpandAutoScroll';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import AnimatedStep, {
  growThenStep,
  useStepSheetHeight,
} from '../../../../functions/CustomElements/redesign/AnimatedStep';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import { AssetDisc, SheetTitle } from '../savings/savingsSheetParts';
import { CoinChainLogo, destinationLabel } from './AccumulationAddressCard';

// Steps: 'chain' | 'destination' | 'confirm'
const STEPS = ['chain', 'destination', 'confirm'];
const STEP_HEIGHTS = { chain: 720, destination: 380, confirm: 440 };

export default function CreateAccumulationAddressModal({
  setContentHeight,
  handleBackPressFunction,
  forcedDestination,
  setDismissLocked,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = GetThemeColors();
  const { addresses, createAddress } = useAccumulationAddresses();
  const { masterInfoObject } = useGlobalContextProvider();
  const { bottomPadding } = useGlobalInsets();

  const [step, setStep] = useState('chain');
  const [direction, setDirection] = useState(1);
  const [expandedChain, setExpandedChain] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedChain, setSelectedChain] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(
    forcedDestination || null,
  );
  const [isCreating, setIsCreating] = useState(false);

  const isPairAtCap = useCallback(
    (chainId, asset, dest) =>
      addresses.filter(
        a =>
          a.sourceChain === chainId &&
          a.sourceAsset === asset &&
          a.destinationAsset === dest,
      ).length >= getAccumulationAddressLimit(masterInfoObject),
    [addresses, masterInfoObject],
  );

  const { scrollViewRef, handleRowLayout, onScroll, onLayout } =
    useExpandAutoScroll({
      expandedId: expandedChain,
      getPanelHeight: getChainExpandHeight,
    });

  useStepSheetHeight(setContentHeight, STEP_HEIGHTS[step]);

  // The sheet can't be swiped away while the address is being created.
  useEffect(() => {
    setDismissLocked?.(isCreating);
  }, [isCreating, setDismissLocked]);

  // A step's exit side is read from its last render while still active, so
  // the direction has to land one render before the step changes.
  const goToStep = useCallback(
    nextStep => {
      setDirection(STEPS.indexOf(nextStep) > STEPS.indexOf(step) ? 1 : -1);
      growThenStep(
        setContentHeight,
        STEP_HEIGHTS[step],
        STEP_HEIGHTS[nextStep],
        () => setTimeout(() => setStep(nextStep), 0),
      );
    },
    [step, setContentHeight],
  );

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

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    const result = await createAddress({
      sourceChain: selectedChain.id,
      sourceAsset: selectedAsset,
      destinationAsset: selectedDestination,
      forceNew: true,
    });
    setIsCreating(false);
    if (result?.address) {
      // On success the new address opens.
      handleBackPressFunction(() =>
        navigate.replace('AccumulationAddressDetail', {
          sourceChain: selectedChain.id,
          sourceAsset: selectedAsset,
          destinationAsset: selectedDestination,
          selectedId: result.address.accumulationAddressId,
        }),
      );
    } else if (result?.error === 'limit_reached') {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.accumulationAddresses.create.limitReached'),
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

  const backBar = (
    <View style={styles.backBar}>
      <TopBar onBack={handleBackPress} />
    </View>
  );

  return (
    <View style={styles.container}>
      <AnimatedStep
        active={step === 'chain'}
        direction={direction}
        exitsBack={direction === -1}
      >
        <SheetTitle
          first={true}
          title={t('screens.accumulationAddresses.create.pickChain')}
          sub={t('screens.accumulationAddresses.create.pickChainSub')}
        />
        <CustomScrollView
          ref={scrollViewRef}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onLayout={onLayout}
        >
          <ListCard tone="flush" dividerInset={44}>
            {ACCUMULATION_CHAINS.map(chain => (
              <View
                key={chain.id}
                onLayout={e =>
                  handleRowLayout(chain.id, e.nativeEvent.layout.y)
                }
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
                  }}
                  isAssetTaken={
                    forcedDestination
                      ? asset => isPairAtCap(chain.id, asset, forcedDestination)
                      : () => false
                  }
                  onDisabledAssetPress={() =>
                    navigate.navigate('ErrorScreen', {
                      errorMessage: t(
                        'screens.accumulationAddresses.create.limitReached',
                      ),
                    })
                  }
                />
              </View>
            ))}
          </ListCard>
        </CustomScrollView>
      </AnimatedStep>

      <AnimatedStep
        active={step === 'destination'}
        direction={direction}
        exitsBack={direction === -1}
      >
        {backBar}
        <SheetTitle
          title={t('screens.accumulationAddresses.create.pickDestination')}
          sub={t('screens.accumulationAddresses.create.pickDestinationSub', {
            asset: selectedAsset,
            chain: selectedChain?.label,
          })}
        />
        <View style={styles.list}>
          <ListCard tone="flush">
            {ACCUMULATION_DESTINATIONS.map(dest => {
              const atCap = isPairAtCap(selectedChain?.id, selectedAsset, dest);
              const currency = destinationLabel(dest, t);
              return (
                <View key={dest} style={atCap && styles.disabledRow}>
                  <ListRow
                    lead={
                      <AssetDisc
                        asset={dest === 'BTC' ? 'bitcoin' : 'dollar'}
                      />
                    }
                    title={currency}
                    titleStyle={styles.rowTitle}
                    sub={t('screens.accumulationAddresses.create.arrivesIn', {
                      currency,
                    })}
                    minHeight={64}
                    trailing="chevron"
                    onPress={() => {
                      if (atCap) {
                        navigate.navigate('ErrorScreen', {
                          errorMessage: t(
                            'screens.accumulationAddresses.create.limitReached',
                          ),
                        });
                        return;
                      }
                      setSelectedDestination(dest);
                      goToStep('confirm');
                    }}
                  />
                </View>
              );
            })}
          </ListCard>
        </View>
      </AnimatedStep>

      <AnimatedStep
        active={step === 'confirm'}
        direction={direction}
        exitsBack={direction === -1}
      >
        {backBar}
        <SheetTitle title={t('screens.accumulationAddresses.create.confirm')} />
        <View style={styles.confirmContent}>
          <View style={styles.assetRow}>
            <CoinChainLogo
              asset={selectedAsset}
              chainLabel={selectedChain?.label}
              size={56}
            />
            <ThemeIcon
              redesign
              iconName="ArrowRight"
              size={22}
              colorOverride={tokens.muted}
            />
            <AssetDisc
              asset={selectedDestination === 'BTC' ? 'bitcoin' : 'dollar'}
              size={56}
            />
          </View>
          <ThemeText
            styles={[styles.confirmSubtitle, { color: tokens.muted }]}
            content={t('screens.accumulationAddresses.create.convertDesc', {
              chain: selectedChain?.label,
              asset: selectedAsset,
              receiveCurrency: destinationLabel(selectedDestination, t),
            })}
          />
        </View>
        <CustomButton
          size="regular"
          textContent={t('screens.accumulationAddresses.summary.create')}
          actionFunction={handleCreate}
          useLoading={isCreating}
        />
      </AnimatedStep>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    overflow: 'hidden',
  },
  backBar: { marginTop: 8 },
  list: { marginTop: 12, flexGrow: 0, flexShrink: 1 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  disabledRow: { opacity: 0.5 },
  confirmContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  confirmSubtitle: {
    maxWidth: 280,
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
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
