import { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import {
  COLORS,
  SIZES,
  FONT,
  SKELETON_ANIMATION_SPEED,
  CENTER,
} from '../../../../../constants';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useNavigation } from '@react-navigation/native';
import { getInfo, sync } from '@breeztech/react-native-breez-sdk-liquid';
import CustomButton from '../../../../../functions/CustomElements/button';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import SkeletonTextPlaceholder from '../../../../../functions/CustomElements/skeletonTextView';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import { useGlobalContacts } from '../../../../../../context-store/globalContacts';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import liquidToSparkSwap from '../../../../../functions/spark/liquidToSparkSwap';
import { useTranslation } from 'react-i18next';
import GetThemeColors from '../../../../../hooks/themeColors';
import CustomToggleSwitch from '../../../../../functions/CustomElements/switch';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../../constants/theme';

export default function LiquidSwapsPage() {
  const { minMaxLiquidSwapAmounts } = useAppStatus();
  const { globalContactsInformation } = useGlobalContacts();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  const [isLoading, setIsLoading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [liquidInfoResponse, setLiquidInfoResponse] = useState(null);
  const autoClaimEnabled = masterInfoObject.enabledLiquidAutoSwap;

  const [skeletonLayout, setSkeletonLayout] = useState({
    height: 45,
    width: 160,
  });
  const maxLayoutRef = useRef({ height: 45, width: 160 });

  const handleSkeletonLayout = useCallback(event => {
    const { height, width } = event.nativeEvent.layout;
    const newH = Math.max(maxLayoutRef.current.height, height);
    const newW = Math.max(maxLayoutRef.current.width, width);
    console.log(height, width);
    if (
      newH !== maxLayoutRef.current.height ||
      newW !== maxLayoutRef.current.width
    ) {
      maxLayoutRef.current = { height: newH, width: newW };
      setSkeletonLayout({ height: newH, width: newW });
    }
  }, []);

  const hasFetched = liquidInfoResponse !== null;

  const balanceSat = liquidInfoResponse?.walletInfo?.balanceSat || 0;
  const pendingSendSat = liquidInfoResponse?.walletInfo?.pendingSendSat || 0;
  const pendingReceiveSat =
    liquidInfoResponse?.walletInfo?.pendingReceiveSat || 0;

  const spendableSat = hasFetched ? balanceSat - pendingSendSat : 0;
  const canSwap = spendableSat > minMaxLiquidSwapAmounts.min;
  const hasPending = pendingReceiveSat > 0 || pendingSendSat > 0;

  const fmt = amount =>
    displayCorrectDenomination({ amount, masterInfoObject, fiatStats });

  const fetchBalance = useCallback(async (showRescanConfirmation = false) => {
    try {
      setIsLoading(true);
      await sync();
      const info = await getInfo();
      setLiquidInfoResponse(info);

      if (showRescanConfirmation) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('settings.viewAllLiquidSwaps.rescanComplete'),
        });
      }
    } catch (err) {
      console.log(err);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const swapLiquidToLightning = async () => {
    if (!canSwap) return;

    try {
      setIsSwapping(true);
      const response = await liquidToSparkSwap(
        globalContactsInformation.myProfile.uniqueName,
      );
      if (!response.didWork) throw new Error(t(response.error));

      navigate.navigate('ErrorScreen', {
        errorMessage: t('settings.viewAllLiquidSwaps.swapStartedMessage'),
      });
      fetchBalance(false);
    } catch (err) {
      console.log(err);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    } finally {
      setIsSwapping(false);
    }
  };

  const handleAutoClaimToggle = () => {
    if (!autoClaimEnabled) {
      swapLiquidToLightning();
    }
    toggleMasterInfoObject({ enabledLiquidAutoSwap: !autoClaimEnabled });
  };

  useEffect(() => {
    fetchBalance(false);
  }, [fetchBalance]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemeText
          styles={styles.heroLabel}
          content={t('settings.viewAllLiquidSwaps.totalBalance')}
        />
        <View style={styles.heroSection}>
          {/* Hidden component for layout measurement */}
          <View
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            onLayout={handleSkeletonLayout}
          >
            <FormattedSatText
              styles={styles.heroBalance}
              balance={balanceSat}
              useSizing={true}
            />
          </View>

          {/* Visible component with skeleton - using max layout dimensions */}
          <View
            style={{
              height: skeletonLayout.height,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <SkeletonTextPlaceholder
              highlightColor={backgroundColor}
              backgroundColor={COLORS.opaicityGray}
              speed={SKELETON_ANIMATION_SPEED}
              enabled={isLoading}
              layout={skeletonLayout}
            >
              <FormattedSatText
                styles={styles.heroBalance}
                balance={balanceSat}
                useSizing={true}
              />
            </SkeletonTextPlaceholder>
          </View>
        </View>

        {hasFetched && hasPending && (
          <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
            <View style={styles.pendingRow}>
              <ThemeText
                styles={styles.pendingLabel}
                content={t('settings.viewAllLiquidSwaps.incoming', {
                  amount: '',
                }).trimEnd()}
              />
              <ThemeText
                styles={styles.pendingValue}
                content={fmt(pendingReceiveSat)}
              />
            </View>
            <View style={[styles.pendingRow]}>
              <ThemeText
                styles={styles.pendingLabel}
                content={t('settings.viewAllLiquidSwaps.outgoing', {
                  amount: '',
                }).trimEnd()}
              />
              <ThemeText
                styles={styles.pendingValue}
                content={fmt(pendingSendSat)}
              />
            </View>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextGroup}>
              <ThemeText
                styles={styles.toggleLabel}
                content={t('settings.viewAllLiquidSwaps.autoClaimLabel', {
                  defaultValue: 'Auto-Claim',
                })}
              />
              <ThemeText
                styles={styles.toggleHelper}
                content={t('settings.viewAllLiquidSwaps.autoClaimHelper', {
                  defaultValue:
                    'Automatically swap Liquid funds to Lightning when the minimum threshold is reached.',
                })}
              />
            </View>
            <CustomToggleSwitch
              page={'liquidSwap'}
              stateValue={autoClaimEnabled}
              toggleSwitchFunction={handleAutoClaimToggle}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={() => fetchBalance(true)}
          disabled={isLoading}
          style={styles.rescanTouchable}
          activeOpacity={0.5}
        >
          <ThemeText
            styles={[styles.rescanText, isLoading && styles.rescanDisabled]}
            content={
              isLoading
                ? t('settings.viewAllLiquidSwaps.rescanning', {
                    defaultValue: 'Scanning…',
                  })
                : t('settings.viewAllLiquidSwaps.rescan')
            }
          />
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.ctaContainer}>
        {hasFetched && !canSwap && (
          <ThemeText
            styles={styles.thresholdHint}
            content={t('settings.viewAllLiquidSwaps.balanceError', {
              balance: fmt(balanceSat),
              swapAmount: fmt(minMaxLiquidSwapAmounts.min),
            })}
          />
        )}

        <CustomButton
          buttonStyles={[
            styles.swapButton,
            !canSwap && styles.swapButtonDisabled,
          ]}
          actionFunction={swapLiquidToLightning}
          textContent={t('settings.viewAllLiquidSwaps.swap')}
          useLoading={isSwapping}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },

  heroSection: {
    justifyContent: 'center',
    position: 'relative',
    width: INSET_WINDOW_WIDTH,
    minHeight: 45,
    marginBottom: 25,
    ...CENTER,
  },
  measurementPass: {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
  },
  heroBalance: {
    fontSize: SIZES.xxLarge,
    textAlign: 'center',
    fontFamily: FONT.Title_Regular,
  },
  heroLabel: {
    textTransform: 'uppercase',
    includeFontPadding: false,
  },

  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },

  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },

  pendingLabel: {
    textTransform: 'capitalize',
  },
  pendingValue: {},

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTextGroup: {
    flex: 1,
    marginRight: 14,
  },
  toggleLabel: {
    marginBottom: 3,
  },
  toggleHelper: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
  },

  rescanTouchable: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  rescanText: {
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  rescanDisabled: {
    opacity: 0.2,
  },

  ctaContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
  },
  thresholdHint: {
    fontSize: SIZES.small,
    opacity: 0.5,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 18,
  },
  swapButton: {
    alignSelf: 'center',
  },
  swapButtonDisabled: {
    opacity: HIDDEN_OPACITY,
  },
});
