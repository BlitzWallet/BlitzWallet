import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  MAX_WEB_CONTENT_WIDTH,
} from '../../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { validateAndNormalizeSmsPhoneNumber } from './utils';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { AsYouType } from 'libphonenumber-js';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../../functions/CustomElements/redesign/PageHeader';
import CountryFlag from 'react-native-country-flag';
import GetThemeColors from '../../../../../hooks/themeColors';
import AmountHero from '../../../../../functions/CustomElements/redesign/AmountHero';

export default function SMSMessagingSendPhonePage(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = GetThemeColors();
  const { fiatStats } = useNodeContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const selectedCountry = props?.route?.params?.selectedCountry;
  const [phoneNumber, setPhoneNumber] = useState(
    props.route?.params?.phoneNumber || '',
  );

  const handleContinue = () => {
    try {
      if (!phoneNumber.length) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('apps.sms4sats.sendPage.invalidPhoneError'),
        });
        return;
      }
      const normalizedPhoneData = validateAndNormalizeSmsPhoneNumber({
        phoneNumber,
        isoCode: selectedCountry.isoCode,
        cc: selectedCountry.cc,
      });

      navigate.navigate('SMSMessagingSendDescriptionPage', {
        selectedCountry: normalizedPhoneData.selectedCountry,
        phoneNumber: normalizedPhoneData.sanitizedPhoneNumber,
        normalizedPhoneNumber: normalizedPhoneData.normalizedPhoneNumber,
      });
    } catch (error) {
      if (error.message === 'unsupported-country') {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('apps.sms4sats.sendPage.unsupportedCountryError'),
        });
      } else {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('apps.sms4sats.sendPage.invalidPhoneError'),
        });
      }
    }
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('constants.send')} />

        <PageHeader
          title={t('apps.sms4sats.sendPage.phoneStepTitle')}
          sub={t('apps.sms4sats.sendPage.phoneStepSubtitle')}
        />

        <View
          style={[styles.locationDetails, { backgroundColor: tokens.surface }]}
        >
          <CountryFlag isoCode={selectedCountry.isoCode} size={12} />
          <ThemeText content={selectedCountry.cc} />
        </View>

        <AmountHero
          formatAmount={false}
          mutedValue={phoneNumber.length === 0}
          amount={
            phoneNumber.length > 15
              ? phoneNumber.slice(0, 15) + '...'
              : phoneNumber.length === 0
              ? '(123) 456-7891'
              : `${new AsYouType(selectedCountry.isoCode).input(
                  `${phoneNumber}`,
                )}`
          }
        />

        <View style={{ flex: 1 }} />

        <CustomNumberKeyboard
          setInputValue={setPhoneNumber}
          frompage={'sendSMSPage'}
          usingForBalance={false}
          fiatStats={fiatStats}
          showDot={false}
          redesign
        />

        <CustomButton
          disabled={!phoneNumber.length}
          buttonStyles={[styles.button]}
          textContent={t('constants.continue')}
          actionFunction={handleContinue}
          size={'regular'}
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
  locationDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    ...CENTER,
    borderRadius: 99,
    marginBottom: 15,
  },
  button: {
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
