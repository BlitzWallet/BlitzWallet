import {StyleSheet, View} from 'react-native';
import {useGlobalContacts} from '../../../../../../context-store/globalContacts';
import QrCodeWrapper from '../../../../../functions/CustomElements/QrWrapper';
import {useTranslation} from 'react-i18next';

export default function MyProfileQRCode() {
  const {globalContactsInformation} = useGlobalContacts();
  const {t} = useTranslation();
  return (
    <View style={styles.container}>
      <QrCodeWrapper
        outerContainerStyle={{width: 275, height: 275}}
        innerContainerStyle={{width: 250, height: 250}}
        qrSize={250}
        QRData={btoa(
          JSON.stringify({
            uniqueName: globalContactsInformation.myProfile.uniqueName,
            name: globalContactsInformation.myProfile.name || '',
            bio:
              globalContactsInformation.myProfile?.bio ||
              t('constants.noBioSet'),
            uuid: globalContactsInformation.myProfile?.uuid,
            receiveAddress: globalContactsInformation.myProfile.receiveAddress,
          }),
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
