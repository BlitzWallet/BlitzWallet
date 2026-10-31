import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { sendCountryCodes } from './sendCountryCodes';
import SMSCountryPickerScreen from './countryPickerScreen';

const SEND_COUNTRIES = sendCountryCodes.map(item => ({
  key: `${item.country}-${item.cc}`,
  label: item.country,
  sub: item.cc,
  isoCode: item.isoCode,
  item,
}));

export default function SMSMessagingSendPage() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const [selected, setSelected] = useState(null);

  return (
    <SMSCountryPickerScreen
      topBarTitle={t('constants.send')}
      title={t('apps.sms4sats.sendPage.countryStepTitle')}
      sub={t('apps.sms4sats.sendPage.countryStepSubtitle')}
      countries={SEND_COUNTRIES}
      selectedKey={selected?.key}
      onSelect={setSelected}
      onNext={() =>
        navigate.navigate('SMSMessagingSendPhonePage', {
          selectedCountry: selected.item,
        })
      }
    />
  );
}
