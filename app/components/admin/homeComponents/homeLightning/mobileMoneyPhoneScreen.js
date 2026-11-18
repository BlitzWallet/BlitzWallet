import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import CountryFlag from 'react-native-country-flag';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../constants';
import { HIDDEN_OPACITY } from '../../../../constants/theme';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomButton from '../../../../functions/CustomElements/button';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../functions/CustomElements/redesign/PageHeader';
import useContentWidth from '../../../../functions/CustomElements/redesign/useContentWidth';
import { useTheme } from '../../../../../context-store/theme';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import {
  getPhonePaymentCandidates,
  getPhonePaymentCountry,
  getPhonePostProvider,
} from '../../../../functions/sendBitcoin/getPhonePaymentAddress';
import { formatNationalDisplay } from './mobileMoneyCountries';

// Route MobileMoneyPhoneScreen: second step of the phone send flow.
export default function MobileMoneyPhoneScreen() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { fiatStats } = useNodeContext();
  const contentWidth = useContentWidth();
  const params = useRoute().params;
  const selectedCountry = params?.selectedCountry;
  const preSelectedPaymentMethod = params?.preSelectedPaymentMethod;

  const [phoneNumber, setPhoneNumber] = useState('');
  // Re-entrancy guard so a double-tap on Next can't fire two navigations.
  const isSubmittingRef = useRef(false);

  // Back from the send pages lands on this screen, so a wrong number can be fixed.
  useFocusEffect(
    useCallback(() => {
      isSubmittingRef.current = false;
    }, []),
  );

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
    navigate.navigate('ConfirmPaymentScreen', {
      btcAdress: intlNumber,
      fromPage: '',
      preSelectedPaymentMethod,
    });
  }, [selectedCountry, phoneNumber, navigate, t, preSelectedPaymentMethod]);

  return (
    <GlobalThemeView useStandardWidth={false}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('constants.send')} />
        <PageHeader
          title={t('wallet.halfModal.mobileMoneyPhoneTitle')}
          sub={t('wallet.halfModal.mobileMoneyPhoneSubtitle', {
            provider: selectedCountry?.provider,
            country: selectedCountry?.country,
          })}
        />

        <View style={styles.phoneInputRow}>
          <View
            style={[styles.countryPill, { backgroundColor: tokens.ground }]}
          >
            {!!selectedCountry && (
              <CountryFlag isoCode={selectedCountry.isoCode} size={20} />
            )}
            <ThemeText styles={styles.ccText} content={selectedCountry?.cc} />
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
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
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
