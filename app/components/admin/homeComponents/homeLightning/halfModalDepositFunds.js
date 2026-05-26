import { StyleSheet, View, TouchableOpacity, TextInput, Linking } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, SIZES, CENTER } from '../../../../constants';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import { useAccumulationAddresses } from '../../../../hooks/useAccumulationAddresses';
import { useWebView } from '../../../../../context-store/webViewContext';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { sparkReceivePaymentWrapper } from '../../../../functions/spark/payments';
import CreateAccumulationAddressModal from '../accumulationAddresses/CreateAccumulationAddressModal';
import CustomButton from '../../../../functions/CustomElements/button';
import { copyToClipboard } from '../../../../functions';
import { useToast } from '../../../../../context-store/toastManager';

const isUSTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone.startsWith('America/');

export default function HalfModalDepositFunds({
  handleBackPressFunction,
  setContentHeight,
  theme,
  darkModeType,
}) {
  const [activeView, setActiveView] = useState('options');
  const [cashAppAmount, setCashAppAmount] = useState('');
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundColor, backgroundOffset, textColor } = GetThemeColors();
  const { addresses } = useAccumulationAddresses();
  const { sendWebViewRequest } = useWebView();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { showToast } = useToast();

  const subviewVisible = activeView !== 'options';

  const subviewOpacity = useSharedValue(0);
  const subviewTranslateX = useSharedValue(30);
  const optionsOpacity = useSharedValue(1);
  const optionsTranslateX = useSharedValue(0);

  useEffect(() => {
    subviewOpacity.value = withTiming(subviewVisible ? 1 : 0, { duration: 250 });
    subviewTranslateX.value = withTiming(subviewVisible ? 0 : 30, { duration: 250 });
    optionsOpacity.value = withTiming(subviewVisible ? 0 : 1, { duration: 250 });
    optionsTranslateX.value = withTiming(subviewVisible ? -30 : 0, { duration: 250 });
  }, [subviewVisible]);

  const optionsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: optionsOpacity.value,
    transform: [{ translateX: optionsTranslateX.value }],
  }));

  const subviewAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subviewOpacity.value,
    transform: [{ translateX: subviewTranslateX.value }],
  }));

  const existingBtcAddress = addresses.find(a => a.destinationAsset === 'BTC') || null;

  const handleCashAppConfirm = useCallback(async () => {
    const amountSats = parseInt(cashAppAmount, 10);
    if (!amountSats || amountSats <= 0) return;
    setIsGeneratingInvoice(true);
    try {
      const response = await sparkReceivePaymentWrapper({
        paymentType: 'lightning',
        amountSats,
        mnemoinc: currentWalletMnemoinc,
        sendWebViewRequest,
        includeSparkAddress: false,
      });
      if (response.didWork) {
        await Linking.openURL(
          `https://cash.app/launch/lightning/${encodeURIComponent(response.invoice)}`,
        );
      }
    } catch (e) {
      // silent
    } finally {
      setIsGeneratingInvoice(false);
    }
  }, [cashAppAmount, currentWalletMnemoinc, sendWebViewRequest]);

  return (
    <View style={styles.container}>
      {/* Options list (tiles) */}
      <Animated.View style={optionsAnimatedStyle}>
        {/* On-Chain Bitcoin */}
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() =>
            navigate.replace('ReceiveBTC', { selectedRecieveOption: 'Bitcoin' })
          }
        >
          <View
            style={[
              styles.scanIconContainer,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundColor : backgroundOffset,
              },
            ]}
          >
            <ThemeIcon
              colorOverride={
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary
              }
              size={24}
              iconName={'Bitcoin'}
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
                  theme && darkModeType ? backgroundColor : backgroundOffset,
              },
            ]}
          >
            <ThemeIcon
              colorOverride={
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary
              }
              size={24}
              iconName={'ArrowLeftRight'}
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
        </TouchableOpacity>

        {/* Cash App (US-only) */}
        {isUSTimezone && (
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setActiveView('cashApp')}
          >
            <View
              style={[
                styles.scanIconContainer,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                },
              ]}
            >
              <ThemeIcon
                colorOverride={
                  theme && darkModeType ? COLORS.darkModeText : COLORS.primary
                }
                size={24}
                iconName={'DollarSign'}
              />
            </View>
            <View style={styles.scanTextContainer}>
              <ThemeText styles={styles.scanButtonText} content={'Cash App'} />
              <ThemeText
                styles={styles.scanButtonSubtext}
                content={t('wallet.halfModal.cashAppSubtitle')}
              />
            </View>
          </TouchableOpacity>
        )}

        {/* Spark Address */}
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigate.replace('SparkReceivePage')}
        >
          <View
            style={[
              styles.scanIconContainer,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundColor : backgroundOffset,
              },
            ]}
          >
            <ThemeIcon
              colorOverride={
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary
              }
              size={24}
              iconName={'Zap'}
            />
          </View>
          <View style={styles.scanTextContainer}>
            <ThemeText styles={styles.scanButtonText} content={'Spark'} />
            <ThemeText
              styles={styles.scanButtonSubtext}
              content={t('wallet.halfModal.sparkAddressSubtitle')}
            />
          </View>
        </TouchableOpacity>

        {/* Other Bitcoin */}
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() =>
            navigate.replace('ReceiveBTC', { selectedRecieveOption: 'Liquid' })
          }
        >
          <View
            style={[
              styles.scanIconContainer,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundColor : backgroundOffset,
              },
            ]}
          >
            <ThemeIcon
              colorOverride={
                theme && darkModeType ? COLORS.darkModeText : COLORS.primary
              }
              size={24}
              iconName={'Globe'}
            />
          </View>
          <View style={styles.scanTextContainer}>
            <ThemeText
              styles={styles.scanButtonText}
              content={t('wallet.halfModal.otherBitcoin')}
            />
            <ThemeText
              styles={styles.scanButtonSubtext}
              content={t('wallet.halfModal.otherBitcoinSubtitle')}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Cash App subview */}
      {activeView === 'cashApp' && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.subviewContainer,
            { backgroundColor },
            subviewAnimatedStyle,
          ]}
        >
          <View style={styles.subviewContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setCashAppAmount('');
                setActiveView('options');
              }}
            >
              <ThemeIcon iconName="ChevronLeft" size={20} />
              <ThemeText content={t('wallet.halfModal.cashAppBack')} />
            </TouchableOpacity>

            <ThemeText
              content={t('wallet.halfModal.cashAppEnterAmount')}
              styles={styles.subviewTitle}
            />

            <TextInput
              style={[
                styles.amountInput,
                { color: textColor, borderColor: backgroundOffset },
              ]}
              value={cashAppAmount}
              onChangeText={setCashAppAmount}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={COLORS.opaicityGray}
            />

            <CustomButton
              buttonStyles={{ ...CENTER, marginTop: 'auto' }}
              textContent={t('wallet.halfModal.cashAppOpen')}
              actionFunction={handleCashAppConfirm}
              useLoading={isGeneratingInvoice}
            />
          </View>
        </Animated.View>
      )}

      {/* Stablecoins subview */}
      {activeView === 'stablecoins' && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.subviewContainer,
            { backgroundColor },
            subviewAnimatedStyle,
          ]}
        >
          <View style={styles.subviewContent}>
            {existingBtcAddress ? (
              <>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setActiveView('options')}
                >
                  <ThemeIcon iconName="ChevronLeft" size={20} />
                  <ThemeText content={t('constants.back')} />
                </TouchableOpacity>

                <ThemeText
                  content={existingBtcAddress.sourceAsset + ' → BTC'}
                  styles={styles.subviewTitle}
                />
                <ThemeText
                  content={
                    existingBtcAddress.depositAddress.slice(0, 12) +
                    '...' +
                    existingBtcAddress.depositAddress.slice(-8)
                  }
                  styles={styles.addressPreview}
                />

                <CustomButton
                  buttonStyles={{ ...CENTER, marginTop: 8 }}
                  textContent={t('constants.copy')}
                  actionFunction={() =>
                    copyToClipboard(existingBtcAddress.depositAddress, showToast)
                  }
                />
                <TouchableOpacity
                  style={styles.viewDetailsLink}
                  onPress={() => {
                    handleBackPressFunction();
                    navigate.navigate('AccumulationAddressDetail', {
                      address: existingBtcAddress,
                    });
                  }}
                >
                  <ThemeText content="View details" styles={styles.viewDetailsText} />
                  <ThemeIcon iconName="ChevronRight" size={16} />
                </TouchableOpacity>
              </>
            ) : (
              <CreateAccumulationAddressModal
                forcedDestination="BTC"
                setContentHeight={() => {}}
                handleBackPressFunction={() => setActiveView('options')}
              />
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    flex: 1,
  },
  subviewContainer: {},
  subviewContent: {
    flex: 1,
    paddingTop: 8,
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
  },
  scanIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
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
});
