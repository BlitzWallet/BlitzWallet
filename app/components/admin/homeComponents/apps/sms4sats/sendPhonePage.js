import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../../../functions/CustomElements/button';
import {
  CENTER,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
} from '../../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { validateAndNormalizeSmsPhoneNumber } from './utils';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { AsYouType } from 'libphonenumber-js';

export default function SMSMessagingSendPhonePage(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { fiatStats } = useNodeContext();
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
      <CustomSettingsTopBar
        label={t('constants.send')}
        shouldDismissKeyboard={true}
      />
      <View style={styles.content}>
        <ThemeText
          styles={styles.title}
          content={t('apps.sms4sats.sendPage.phoneStepTitle')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('apps.sms4sats.sendPage.phoneStepSubtitle')}
        />

        <ThemeText
          styles={{
            ...styles.input,
            opacity: phoneNumber.length === 0 ? HIDDEN_OPACITY : 1,
          }}
          content={
            phoneNumber.length > 15
              ? phoneNumber.slice(0, 15) + '...'
              : phoneNumber.length === 0
              ? '(123) 456-7891'
              : `${new AsYouType(selectedCountry.isoCode).input(
                  `${phoneNumber}`,
                )}`
          }
        />
      </View>

      <CustomNumberKeyboard
        setInputValue={setPhoneNumber}
        frompage={'sendSMSPage'}
        usingForBalance={false}
        fiatStats={fiatStats}
        showDot={false}
      />

      <CustomButton
        buttonStyles={[
          styles.button,
          { opacity: phoneNumber.length ? 1 : HIDDEN_OPACITY },
        ]}
        textContent={t('constants.continue')}
        actionFunction={handleContinue}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 28,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
  },
  input: {
    fontSize: SIZES.xLarge,
    textAlign: 'center',
  },
  preview: {
    width: '100%',
    marginTop: 12,
    textAlign: 'center',
  },
  button: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
