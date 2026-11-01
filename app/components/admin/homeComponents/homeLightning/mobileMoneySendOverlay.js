import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import CountryFlag from 'react-native-country-flag';
import { AsYouType } from 'libphonenumber-js';
import { CENTER, CONTENT_KEYBOARD_OFFSET, SIZES } from '../../../../constants';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import { ThemeText } from '../../../../functions/CustomElements';
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
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import PageHeader from '../../../../functions/CustomElements/redesign/PageHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import useContentWidth from '../../../../functions/CustomElements/redesign/useContentWidth';

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

const PAGE_DURATION = 250;

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
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor, tokens } = GetThemeColors();
  const { screenDimensions } = useAppStatus();
  const { fiatStats } = useNodeContext();
  const contentWidth = useContentWidth();

  const [activeView, setActiveView] = useState('country'); // 'country' | 'phone'
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  // Re-entrancy guard so a double-tap on Pay can't fire two navigations.
  const isSubmittingRef = useRef(false);
  // The country step only animates in when returning from the phone step, not on first open.
  const hasOpenedPhoneStep = useRef(false);
  // Exiting props are read from the last render before unmount, so the country
  // step only gets its slide-out one commit before we switch to the phone step.
  // Closing the overlay from the country step stays fade-only.
  const [leavingCountry, setLeavingCountry] = useState(false);

  useEffect(() => {
    if (!leavingCountry) return;
    setActiveView('phone');
    setLeavingCountry(false);
  }, [leavingCountry]);

  // Reset to the first step on every fresh open.
  useEffect(() => {
    hasOpenedPhoneStep.current = false;
    if (visible) {
      setActiveView('country');
      setSelectedCountry(null);
      setPhoneNumber('');
      isSubmittingRef.current = false;
    }
  }, [visible]);

  // Back from the send pages lands on this step, so a wrong number can be fixed.
  useFocusEffect(
    useCallback(() => {
      isSubmittingRef.current = false;
    }, []),
  );

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
    hasOpenedPhoneStep.current = true;
    setLeavingCountry(true);
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
      navigate.navigate('ConfirmPaymentScreen', {
        btcAdress: intlNumber,
        fromPage: '',
      });
    });
  }, [selectedCountry, phoneNumber, navigate, t, handleBackPressFunction]);

  const CountryItem = useCallback(
    ({ item }) => {
      return (
        <ListRow
          onPress={() => handleSelectCountry(item)}
          lead={
            <View style={styles.flagContainer}>
              <CountryFlag isoCode={item.isoCode} size={45} />
            </View>
          }
          title={item.country}
          sub={item.provider}
          showChevron
        />
      );
    },
    [
      handleSelectCountry,
      backgroundOffset,
      theme,
      darkModeType,
      backgroundColor,
    ],
  );

  if (!visible) return null;

  return (
    <Animated.View
      key="overlay-fade"
      entering={FadeIn.duration(PAGE_DURATION)}
      exiting={FadeOut.duration(PAGE_DURATION)}
      style={styles.container}
    >
      {activeView === 'country' ? (
        // Step: country picker
        <Animated.View
          key="country-step-fade"
          entering={
            hasOpenedPhoneStep.current
              ? FadeIn.duration(PAGE_DURATION)
              : undefined
          }
          exiting={FadeOut.duration(PAGE_DURATION)}
          style={styles.step}
        >
          <Animated.View
            key="country-step-slide"
            entering={
              hasOpenedPhoneStep.current
                ? SlideInLeft.duration(PAGE_DURATION)
                : undefined
            }
            exiting={
              leavingCountry ? SlideOutLeft.duration(PAGE_DURATION) : undefined
            }
            style={[styles.step, { paddingBottom: bottomPadding }]}
          >
            <View style={[styles.content, { width: contentWidth }]}>
              <PageHeader
                title={t('wallet.halfModal.mobileMoneyCountryTitle')}
                sub={t('wallet.halfModal.mobileMoneyCountrySubtitle')}
              />
              <ListCard style={styles.card}>
                <FlatList
                  data={MOBILE_MONEY_COUNTRIES}
                  renderItem={CountryItem}
                  showsVerticalScrollIndicator={false}
                />
              </ListCard>
            </View>
          </Animated.View>
        </Animated.View>
      ) : (
        // Step: phone entry
        <Animated.View
          key="phone-step-fade"
          entering={FadeIn.duration(PAGE_DURATION)}
          exiting={FadeOut.duration(PAGE_DURATION)}
          style={styles.step}
        >
          <Animated.View
            key="phone-step-slide"
            entering={SlideInRight.duration(PAGE_DURATION)}
            exiting={SlideOutRight.duration(PAGE_DURATION)}
            style={[styles.step, { paddingBottom: bottomPadding }]}
          >
            <View style={[styles.content, { width: contentWidth }]}>
              <PageHeader
                title={t('wallet.halfModal.mobileMoneyPhoneTitle')}
                sub={t('wallet.halfModal.mobileMoneyPhoneSubtitle', {
                  provider: selectedCountry?.provider,
                  country: selectedCountry?.country,
                })}
              />

              <View style={styles.phoneInputRow}>
                <View
                  style={[
                    styles.countryPill,
                    { backgroundColor: tokens.ground },
                  ]}
                >
                  {!!selectedCountry && (
                    <CountryFlag isoCode={selectedCountry.isoCode} size={20} />
                  )}
                  <ThemeText
                    styles={styles.ccText}
                    content={selectedCountry?.cc}
                  />
                </View>
                <View
                  style={[
                    styles.phoneField,
                    {
                      backgroundColor: tokens.surface,
                      borderColor: tokens.accent,
                    },
                  ]}
                >
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

              <View style={styles.keyboardContainer}>
                <CustomNumberKeyboard
                  setInputValue={setPhoneNumber}
                  frompage={'sendSMSPage'}
                  usingForBalance={false}
                  showDot={false}
                  fiatStats={fiatStats}
                  redesign
                />
              </View>

              <CustomButton
                size="regular"
                buttonStyles={[
                  styles.button,
                  { opacity: phoneNumber.length ? 1 : HIDDEN_OPACITY },
                ]}
                textContent={t('constants.next')}
                actionFunction={handlePay}
              />
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexShrink: 1 },
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
    fontSize: SIZES.small,
    opacity: 0.6,
    marginTop: 2,
    includeFontPadding: false,
  },
  keyboardContainer: { marginTop: 'auto' },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  countryPill: {
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneField: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
  },
  ccText: {
    fontSize: 15,
    includeFontPadding: false,
  },
  phoneInput: {
    fontSize: 16,
    includeFontPadding: false,
  },
  button: {
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
