import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, SIZES, CENTER } from '../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import CreateAccumulationAddressDepositModal from '../accumulationAddresses/CreateAccumulationAddressDepositModal';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { Image } from 'expo-image';
import ICONS from '../../../../constants/icons';
import { useAppStatus } from '../../../../../context-store/appStatus';
import SelectOtherReceiveOptionHalfModal from './halfModalOtherOptions';
import AddFundsFromBankHalfModal from './halfModalBank';
import DepositQRView from './depositQRView';

const capitalize = value =>
  value ? value[0].toUpperCase() + value.slice(1) : '';

export default function HalfModalDepositFunds({
  handleBackPressFunction,
  setContentHeight,
  setBackNav,
  theme,
  darkModeType,
  showLightning = false,
}) {
  const [activeView, setActiveView] = useState('options');
  const [qrConfig, setQrConfig] = useState(null);
  const [expandedChain, setExpandedChain] = useState(null);

  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const { bottomPadding, screenDimensions } = useAppStatus();

  // Fix 1: Separate shared values per subview so exit animation can play
  const stablecoinsOpacity = useSharedValue(0);
  const stablecoinsTranslateX = useSharedValue(30);
  const optionsOpacity = useSharedValue(1);
  const optionsTranslateX = useSharedValue(0);
  const othersOpacity = useSharedValue(0);
  const othersTranslateX = useSharedValue(30);
  const bankOpacity = useSharedValue(0);
  const bankTranslateX = useSharedValue(30);
  const qrOpacity = useSharedValue(0);

  useEffect(() => {
    const showStablecoins = activeView === 'stablecoins';
    const showOthers = activeView === 'others';
    const showOptions = activeView === 'options';
    const showBank = activeView === 'bank';
    const showQR = activeView === 'qr';

    stablecoinsOpacity.value = withTiming(showStablecoins ? 1 : 0, {
      duration: 250,
    });
    stablecoinsTranslateX.value = withTiming(showStablecoins ? 0 : 30, {
      duration: 250,
    });
    othersOpacity.value = withTiming(showOthers ? 1 : 0, {
      duration: 250,
    });
    othersTranslateX.value = withTiming(showOthers ? 0 : 30, {
      duration: 250,
    });
    optionsOpacity.value = withTiming(showOptions ? 1 : 0, { duration: 250 });
    optionsTranslateX.value = withTiming(showOptions ? 0 : -30, {
      duration: 250,
    });
    bankOpacity.value = withTiming(showBank ? 1 : 0, {
      duration: 250,
    });
    bankTranslateX.value = withTiming(showBank ? 0 : -30, {
      duration: 250,
    });
    qrOpacity.value = withTiming(showQR ? 1 : 0, {
      duration: 250,
    });
  }, [activeView]);

  const optionsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: optionsOpacity.value,
    transform: [{ translateX: optionsTranslateX.value }],
  }));

  const stablecoinsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: stablecoinsOpacity.value,
    transform: [{ translateX: stablecoinsTranslateX.value }],
  }));

  const othersAnimatedStyle = useAnimatedStyle(() => ({
    opacity: othersOpacity.value,
    transform: [{ translateX: othersTranslateX.value }],
  }));

  const bankAnimatedStyle = useAnimatedStyle(() => ({
    opacity: bankOpacity.value,
    transform: [{ translateX: bankTranslateX.value }],
  }));

  const qrAnimatedStyle = useAnimatedStyle(() => ({
    opacity: qrOpacity.value,
  }));

  const restoreOptionsHeight = useCallback(() => {
    setContentHeight(Math.round(screenDimensions.height * 0.6));
  }, [setContentHeight, screenDimensions]);

  const handleShowQR = useCallback(config => {
    setQrConfig(config);
    setActiveView('qr');
  }, []);

  // Per-page back behavior: QR/others/lightning/bank return to the main
  // options list; the stablecoin picker first collapses an expanded chain
  // (its "previous step") before returning to options.
  const handleStepBack = useCallback(() => {
    if (activeView === 'options') return false;
    if (activeView === 'stablecoins' && expandedChain) {
      setExpandedChain(null);
      return true;
    }
    if (activeView === 'qr') restoreOptionsHeight();
    setActiveView('options');
    return true;
  }, [activeView, expandedChain, restoreOptionsHeight]);

  // Android hardware back mirrors the visual back arrow.
  useHandleBackPressNew(handleStepBack);

  // Title shown in the chrome header next to the back arrow, per subview.
  // The main options list and the title-less lightning/bank views show none.
  const headerTitle = useMemo(() => {
    switch (activeView) {
      case 'qr': {
        const option = qrConfig?.selectedRecieveOption?.toLowerCase();
        return option === 'stablecoins'
          ? capitalize(qrConfig?.sourceChain)
          : capitalize(qrConfig?.selectedRecieveOption);
      }
      case 'others':
        return t('wallet.halfModal.othersOptionTitle');
      case 'stablecoins':
        return t('screens.accumulationAddresses.create.pickChain');
      default:
        return '';
    }
  }, [activeView, qrConfig, t]);

  // Register/unregister the chrome's back arrow + header based on the subview.
  useEffect(() => {
    if (activeView === 'options') {
      setBackNav?.(null);
    } else {
      setBackNav?.({ onPress: handleStepBack, title: headerTitle });
    }
    return () => setBackNav?.(null);
  }, [activeView, headerTitle, handleStepBack, setBackNav]);

  return (
    <View style={styles.container}>
      {/* Options list (tiles) — Fix 2: pointerEvents blocks interaction when hidden */}
      <Animated.View
        style={[styles.animatedContainer, optionsAnimatedStyle]}
        pointerEvents={activeView === 'options' ? 'auto' : 'none'}
      >
        <ThemeText
          styles={styles.stepTitle}
          content={
            showLightning
              ? t('wallet.halfModal.chooseMethodTitle')
              : t('wallet.halfModal.selectMethodTitle')
          }
        />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomPadding }}
        >
          {/* Lightning Invoice */}
          {showLightning && (
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => setActiveView('lightning')}
            >
              <View
                style={[
                  styles.scanIconContainer,
                  {
                    backgroundColor:
                      theme && darkModeType ? backgroundColor : COLORS.primary,
                  },
                ]}
              >
                <Image
                  source={ICONS.lightningReceiveIcon}
                  style={[
                    styles.rowIcon,
                    { tintColor: 'white', width: 15, height: 20 },
                  ]}
                />
              </View>
              <View style={styles.scanTextContainer}>
                <ThemeText
                  styles={styles.scanButtonText}
                  content={t('wallet.halfModal.lightningInvoice')}
                />
                <ThemeText
                  styles={styles.scanButtonSubtext}
                  content={t('wallet.halfModal.lightningInvoiceSubtitle')}
                />
              </View>
              <View style={{ opacity: HIDDEN_OPACITY }}>
                <ThemeIcon iconName={'ChevronRight'} size={18} />
              </View>
            </TouchableOpacity>
          )}

          {/* On-Chain Bitcoin */}
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => handleShowQR({ selectedRecieveOption: 'Bitcoin' })}
          >
            <View
              style={[
                styles.scanIconContainer,
                {
                  backgroundColor:
                    theme && darkModeType
                      ? backgroundColor
                      : COLORS.bitcoinOrange,
                },
              ]}
            >
              <Image
                source={ICONS.bitcoinIcon}
                style={[styles.rowIcon, { tintColor: 'white' }]}
              />
            </View>
            <View style={styles.scanTextContainer}>
              <ThemeText
                styles={styles.scanButtonText}
                content={t('wallet.halfModal.onChainBitcoin')}
              />
              <ThemeText
                styles={styles.scanButtonSubtext}
                content={t('wallet.halfModal.onChainBitcoinSubtitle')}
              />
            </View>
            <View style={{ opacity: HIDDEN_OPACITY }}>
              <ThemeIcon iconName={'ChevronRight'} size={18} />
            </View>
          </TouchableOpacity>

          {/* Stablecoins */}
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setActiveView('stablecoins')}
          >
            <View
              style={[
                styles.scanIconContainer,
                {
                  backgroundColor:
                    theme && darkModeType
                      ? backgroundColor
                      : COLORS.dollarGreen,
                },
              ]}
            >
              <Image
                source={ICONS.dollarIcon}
                style={[styles.rowIcon, { tintColor: 'white' }]}
              />
            </View>
            <View style={styles.scanTextContainer}>
              <ThemeText
                styles={styles.scanButtonText}
                content={t('wallet.halfModal.stablecoins')}
              />
              <ThemeText
                styles={styles.scanButtonSubtext}
                content={t('wallet.halfModal.stablecoinsSubtitle')}
              />
            </View>
            <View style={{ opacity: HIDDEN_OPACITY }}>
              <ThemeIcon iconName={'ChevronRight'} size={18} />
            </View>
          </TouchableOpacity>

          {/* Other Bitcoin */}
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setActiveView('others')}
          >
            <View
              style={[
                styles.scanIconContainer,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : COLORS.primary,
                },
              ]}
            >
              <ThemeIcon
                colorOverride={COLORS.darkModeText}
                size={20}
                iconName={'Ellipsis'}
              />
            </View>
            <View style={styles.scanTextContainer}>
              <ThemeText
                styles={styles.scanButtonText}
                content={'Other Methods'}
              />
              <ThemeText
                styles={styles.scanButtonSubtext}
                content={t('wallet.halfModal.otherBitcoinSubtitle')}
              />
            </View>
            <View style={{ opacity: HIDDEN_OPACITY }}>
              <ThemeIcon iconName={'ChevronRight'} size={18} />
            </View>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Stablecoins subview */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.animatedContainer,
          {
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          },
          stablecoinsAnimatedStyle,
        ]}
        pointerEvents={activeView === 'stablecoins' ? 'auto' : 'none'}
      >
        <CreateAccumulationAddressDepositModal
          setContentHeight={() => {}}
          handleBackPressFunction={handleBackPressFunction}
          onShowQR={handleShowQR}
          expandedChain={expandedChain}
          setExpandedChain={setExpandedChain}
        />
      </Animated.View>

      {/* Others subview */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.animatedContainer,
          {
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          },
          othersAnimatedStyle,
        ]}
        pointerEvents={activeView === 'others' ? 'auto' : 'none'}
      >
        <SelectOtherReceiveOptionHalfModal
          handleBackPressFunction={handleBackPressFunction}
          onShowQR={handleShowQR}
        />
      </Animated.View>

      {/* bank subview */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.animatedContainer,
          {
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          },
          bankAnimatedStyle,
        ]}
        pointerEvents={activeView === 'bank' ? 'auto' : 'none'}
      >
        <AddFundsFromBankHalfModal
          handleBackPressFunction={handleBackPressFunction}
          setContentHeight={setContentHeight}
          activeView={activeView}
        />
      </Animated.View>

      {/* qr subview */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.animatedContainer,
          {
            backgroundColor:
              theme && darkModeType ? backgroundOffset : backgroundColor,
          },
          qrAnimatedStyle,
        ]}
        pointerEvents={activeView === 'qr' ? 'auto' : 'none'}
      >
        <DepositQRView
          config={qrConfig}
          setContentHeight={setContentHeight}
          onBack={handleStepBack}
          isActive={activeView === 'qr'}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    flex: 1,
  },
  animatedContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: SIZES.large,
    fontWeight: 500,
    marginBottom: 8,
    includeFontPadding: false,
  },
  subviewContainer: {},
  subviewContent: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  subviewTitle: {
    fontSize: SIZES.large,
    fontWeight: 500,
    marginBottom: 12,
    includeFontPadding: false,
  },
  amountInput: {
    width: '100%',
    fontSize: SIZES.large,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  addressPreview: {
    fontSize: SIZES.small,
    opacity: 0.6,
    marginBottom: 8,
    includeFontPadding: false,
  },
  viewDetailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 4,
  },
  viewDetailsText: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
  },
  scanButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 8,
    gap: 15,
  },
  scanIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTextContainer: {
    flex: 1,
  },
  scanButtonText: {
    fontSize: SIZES.medium,
    marginBottom: 2,
    includeFontPadding: false,
  },
  scanButtonSubtext: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
  },
  rowIcon: {
    width: 26,
    height: 26,
  },
  otherIconGrid: {
    alignItems: 'center',
    gap: 3,
  },
  otherIconRow: {
    flexDirection: 'row',
    gap: 3,
  },
  otherSmallIcon: {
    width: 13,
    height: 13,
  },
});
