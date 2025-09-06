import {StyleSheet, View} from 'react-native';
import {SIZES} from '../../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {useEffect, useState} from 'react';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {getLocalStorageItem} from '../../../../../functions';
import CustomButton from '../../../../../functions/CustomElements/button';
import {encriptMessage} from '../../../../../functions/messaging/encodingAndDecodingMessages';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {useKeysContext} from '../../../../../../context-store/keys';
import {useTranslation} from 'react-i18next';

export default function SMSMessagingHome() {
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {decodedMessages, toggleGlobalAppDataInformation} = useGlobalAppData();
  const navigate = useNavigation();
  const [smsServices, setSmsServices] = useState([]);
  const sentMessages = decodedMessages?.sent;
  const {t} = useTranslation();

  useEffect(() => {
    (async () => {
      const localStoredMessages =
        JSON.parse(await getLocalStorageItem('savedSMS4SatsIds')) || [];

      if (localStoredMessages.length != 0) {
        const newMessageObject = [
          ...localStoredMessages,
          ...decodedMessages.sent,
        ];
        const em = encriptMessage(
          contactsPrivateKey,
          publicKey,
          JSON.stringify(newMessageObject),
        );

        toggleGlobalAppDataInformation({messagesApp: em}, true);
      }

      try {
        const smsReceiveServicesResponse = await fetch(
          'https://api2.sms4sats.com/getnumbersstatus?country=999',
          {
            method: 'GET',
          },
        );
        const smsServiceData = await smsReceiveServicesResponse.json();
        setSmsServices(smsServiceData);
      } catch (err) {
        console.log(err);
        navigate.navigate('ErrorScreen', {
          errorMessage: t('apps.sms4sats.home.pricingError'),
        });
      }
    })();
  }, [
    contactsPrivateKey,
    publicKey,
    sentMessages,
    toggleGlobalAppDataInformation,
  ]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar />
      <View style={styles.homepage}>
        <ThemeText
          styles={{textAlign: 'center', fontSize: SIZES.large}}
          content={t('apps.sms4sats.home.pageDescription')}
        />
        <CustomButton
          buttonStyles={{width: '80%', marginTop: 50}}
          actionFunction={() => navigate.navigate('SMSMessagingSendPage')}
          textContent={t('constants.send')}
        />
        <CustomButton
          buttonStyles={{width: '80%', marginTop: 50}}
          actionFunction={() =>
            navigate.navigate('SMSMessagingReceivedPage', {smsServices})
          }
          textContent={t('constants.receive')}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  homepage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
