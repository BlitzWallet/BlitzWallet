import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import CountryFlag from 'react-native-country-flag';
import { AsYouType } from 'libphonenumber-js';

import { CENTER, CONTENT_KEYBOARD_OFFSET, SIZES } from '../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import CustomButton from '../../../../functions/CustomElements/button';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import GetThemeColors from '../../../../hooks/themeColors';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import {
  getPhonePaymentCandidates,
  getPhonePaymentCountry,
  getPhonePostProvider,
} from '../../../../functions/sendBitcoin/getPhonePaymentAddress';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { useNodeContext } from '../../../../../context-store/nodeContext';

// The three mobile-money providers we support. `isoCode`/`cc` must stay aligned
// with the providers in getPhonePaymentAddress.js (KE=bitcoin.co.ke,
// PH=zapremit.com, ZM=bitzed.xyz) so the E.164 string resolves downstream.
// `provider` is display-only. `example` is a valid national mobile number (no
// trunk prefix) used to render a country-correct placeholder.
const MOBILE_MONEY_COUNTRIES = [
  {
    country: 'Kenya',
    isoCode: 'KE',
    cc: '+254',
    provider: 'M-Pesa',
    example: '712123456',
  },
  {
    country: 'Philippines',
    isoCode: 'PH',
    cc: '+63',
    provider: 'GCash',
    example: '9051234567',
  },
  {
    country: 'Zambia',
    isoCode: 'ZM',
    cc: '+260',
    provider: 'Airtel, MTN, or Zamtel',
    example: '955123456',
  },
  // POST-based provider (exchanger.mysatoshis.bi) — no LNURL address.
  {
    country: 'Burundi',
    isoCode: 'BI',
    cc: '+257',
    provider: 'Lumicash',
    example: '79561234',
  },
];

// Formats the national digits the way they appear after the country-code chip.
// AsYouType only groups these countries' numbers when given the country code, so
// we format the full international number and strip the leading code.
const formatNationalDisplay = (country, digits) => {
  if (!country) return '';
  const full = new AsYouType().input(`${country.cc}${digits ?? ''}`);
  return full.startsWith(country.cc)
    ? full.slice(country.cc.length).trimStart()
    : full;
};

export default function MobileMoneySendOverlay({
  visible,
  onClose,
  handleBackPressFunction,
  navigate,
  setBackNav,
  setContentHeight,
}) {
  const { t } = useTranslation();
  const { bottomPadding } = useGlobalInsets();
  const { backgroundOffset } = GetThemeColors();
  const { screenDimensions } = useAppStatus();
  const { fiatStats } = useNodeContext();

  const [activeView, setActiveView] = useState('country'); // 'country' | 'phone'
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  // Re-entrancy guard so a double-tap on Pay can't fire two navigations.
  const isSubmittingRef = useRef(false);

  const overlayOpacity = useSharedValue(0);
  const countryOpacity = useSharedValue(1);
  const countryTranslateX = useSharedValue(0);
  const phoneOpacity = useSharedValue(0);
  const phoneTranslateX = useSharedValue(30);

  // Fade the overlay in/out and reset to the first step on every fresh open.
  useEffect(() => {
    overlayOpacity.value = withTiming(visible ? 1 : 0, { duration: 250 });
    if (visible) {
      setActiveView('country');
      setSelectedCountry(null);
      setPhoneNumber('');
      isSubmittingRef.current = false;
      countryOpacity.value = 1;
      countryTranslateX.value = 0;
      phoneOpacity.value = 0;
      phoneTranslateX.value = 30;
    }
  }, [visible]);

  // Cross-fade between the country step and the phone step.
  useEffect(() => {
    const showPhone = activeView === 'phone';
    countryOpacity.value = withTiming(showPhone ? 0 : 1, { duration: 250 });
    countryTranslateX.value = withTiming(showPhone ? -30 : 0, {
      duration: 250,
    });
    phoneOpacity.value = withTiming(showPhone ? 1 : 0, { duration: 250 });
    phoneTranslateX.value = withTiming(showPhone ? 0 : 30, { duration: 250 });
  }, [activeView]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0.5 ? 'auto' : 'none',
  }));
  const countryStyle = useAnimatedStyle(() => ({
    opacity: countryOpacity.value,
    transform: [{ translateX: countryTranslateX.value }],
  }));
  const phoneStyle = useAnimatedStyle(() => ({
    opacity: phoneOpacity.value,
    transform: [{ translateX: phoneTranslateX.value }],
  }));

  const handleStepBack = useCallback(() => {
    if (!visible) return false;
    if (activeView === 'phone') {
      setActiveView('country');
      return true;
    }
    onClose();
    return true;
  }, [visible, activeView, onClose]);

  useHandleBackPressNew(handleStepBack);

  // Register the modal chrome back arrow and grow the modal to full height so
  // the keypad + button fit; restore the default height on close.
  useEffect(() => {
    if (!visible) return;
    setContentHeight(screenDimensions.height);
    setBackNav?.({ onPress: handleStepBack, title: '' });
    return () => {
      setBackNav?.(null);
      setContentHeight(Math.round(screenDimensions.height * 0.8));
    };
  }, [
    visible,
    handleStepBack,
    setBackNav,
    setContentHeight,
    screenDimensions.height,
  ]);

  const handleSelectCountry = useCallback(country => {
    setSelectedCountry(country);
    setPhoneNumber('');
    setActiveView('phone');
  }, []);

  const handlePay = useCallback(() => {
    if (isSubmittingRef.current || !selectedCountry) return;

    const intlNumber = `${selectedCountry.cc}${phoneNumber}`;
    // Validate with the same logic the confirm pipeline uses to resolve the
    // provider address, guaranteeing a downstream match for the chosen country.
    const candidates = getPhonePaymentCandidates(intlNumber);
    const isValid =
      candidates.some(
        c => getPhonePaymentCountry(c) === selectedCountry.isoCode,
      ) ||
      getPhonePostProvider(intlNumber)?.country === selectedCountry.isoCode;
    if (!isValid) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('wallet.halfModal.mobileMoneyInvalidPhone'),
      });
      return;
    }

    isSubmittingRef.current = true;
    handleBackPressFunction(() => {
      navigate.replace('ConfirmPaymentScreen', {
        btcAdress: intlNumber,
        fromPage: '',
      });
    });
  }, [selectedCountry, phoneNumber, navigate, t, handleBackPressFunction]);

  const CountryItem = useCallback(
    ({ item }) => {
      return (
        <TouchableOpacity
          key={item.isoCode}
          onPress={() => handleSelectCountry(item)}
          style={[styles.countryRow, { backgroundColor: backgroundOffset }]}
        >
          <View style={styles.flagContainer}>
            <CountryFlag isoCode={item.isoCode} size={45} />
          </View>
          <View style={styles.countryTextContainer}>
            <ThemeText styles={styles.countryName} content={item.country} />
            <ThemeText
              styles={styles.countryProvider}
              content={item.provider}
            />
          </View>
          <ThemeIcon iconName={'ChevronRight'} size={20} />
        </TouchableOpacity>
      );
    },
    [handleSelectCountry, backgroundOffset],
  );

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, overlayStyle]}>
      {/* Step: country picker */}
      <Animated.View
        style={[styles.step, countryStyle, { paddingBottom: bottomPadding }]}
        pointerEvents={activeView === 'country' ? 'auto' : 'none'}
      >
        <View style={styles.content}>
          <ThemeText
            styles={styles.title}
            content={t('wallet.halfModal.mobileMoneyCountryTitle')}
          />
          <ThemeText
            styles={styles.subtitle}
            content={t('wallet.halfModal.mobileMoneyCountrySubtitle')}
          />

          <FlatList
            data={MOBILE_MONEY_COUNTRIES}
            renderItem={CountryItem}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Animated.View>

      {/* Step: phone entry */}
      <Animated.View
        style={[styles.step, phoneStyle, { paddingBottom: bottomPadding }]}
        pointerEvents={activeView === 'phone' ? 'auto' : 'none'}
      >
        <View style={styles.content}>
          <ThemeText
            styles={styles.title}
            content={t('wallet.halfModal.mobileMoneyPhoneTitle')}
          />
          <ThemeText
            styles={styles.subtitle}
            content={t('wallet.halfModal.mobileMoneyPhoneSubtitle', {
              provider: selectedCountry?.provider,
              country: selectedCountry?.country,
            })}
          />

          <View style={styles.phoneInputRow}>
            <ThemeText styles={styles.ccText} content={selectedCountry?.cc} />
            <ThemeText
              styles={{
                ...styles.phoneInput,
                opacity: phoneNumber.length === 0 ? HIDDEN_OPACITY : 1,
              }}
              content={
                phoneNumber.length === 0
                  ? formatNationalDisplay(
                      selectedCountry,
                      selectedCountry?.example,
                    )
                  : formatNationalDisplay(selectedCountry, phoneNumber)
              }
            />
          </View>
        </View>

        <CustomNumberKeyboard
          setInputValue={setPhoneNumber}
          frompage={'sendSMSPage'}
          usingForBalance={false}
          showDot={false}
          fiatStats={fiatStats}
        />

        <CustomButton
          buttonStyles={[
            styles.button,
            { opacity: phoneNumber.length ? 1 : HIDDEN_OPACITY },
          ]}
          textContent={t('constants.pay')}
          actionFunction={handlePay}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  step: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
    includeFontPadding: false,
  },
  countryRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  flagContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  countryName: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  countryProvider: {
    fontSize: SIZES.smedium,
    opacity: 0.6,
    marginTop: 2,
    includeFontPadding: false,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  ccText: {
    fontSize: SIZES.xLarge,
    includeFontPadding: false,
  },
  phoneInput: {
    fontSize: SIZES.xLarge,
    textAlign: 'center',
    includeFontPadding: false,
  },
  button: {
    ...CENTER,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
