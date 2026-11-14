import { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { countrymap } from './receiveCountryCodes';
import SMSCountryPickerScreen from './countryPickerScreen';

// Deduplicate countrymap by iso code, keeping first occurrence
const RECEIVE_COUNTRIES = (() => {
  const seen = new Set();
  return countrymap
    .filter(item => {
      if (seen.has(item.iso)) return false;
      seen.add(item.iso);
      return true;
    })
    .map(item => ({
      key: `${item.iso}-${item.value}`,
      label: item.label,
      isoCode: item.iso,
      item,
    }));
})();

export default function SMSMessagingReceiveCountryPage() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const autoSelect = useMemo(() => {
    const item = {
      value: 999,
      label: t('apps.sms4sats.receivePage.autoSelect'),
      iso: 'WW',
    };
    return {
      key: 'auto',
      label: item.label,
      sub: t('apps.sms4sats.receivePage.recommended'),
      isoCode: 'WW',
      item,
    };
  }, [t]);
  const [selected, setSelected] = useState(autoSelect);

  return (
    <SMSCountryPickerScreen
      topBarTitle={t('constants.receive')}
      title={t('apps.sms4sats.receivePage.countryStepTitle')}
      sub={t('apps.sms4sats.receivePage.autoSelectInfoMessage')}
      countries={RECEIVE_COUNTRIES}
      pinned={[autoSelect]}
      selectedKey={selected?.key}
      onSelect={setSelected}
      onNext={() =>
        navigate.navigate('SMSMessagingReceivedPage', {
          selectedCountry: selected.item,
        })
      }
    />
  );
}
