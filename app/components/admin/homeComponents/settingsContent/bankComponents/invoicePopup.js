import {ScrollView, StyleSheet, TouchableOpacity} from 'react-native';
import {copyToClipboard} from '../../../../../functions';
import QrCodeWrapper from '../../../../../functions/CustomElements/QrWrapper';
import {useToast} from '../../../../../../context-store/toastManager';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useTranslation} from 'react-i18next';

export default function CustomQrCode({data}) {
  const {showToast} = useToast();
  const {t} = useTranslation();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}>
      <TouchableOpacity
        onPress={() => {
          copyToClipboard(data, showToast);
        }}>
        <QrCodeWrapper
          outerContainerStyle={{width: 275, height: 275}}
          innerContainerStyle={{width: 250, height: 250}}
          qrSize={250}
          QRData={data}
        />
      </TouchableOpacity>
      <CustomButton
        actionFunction={() => copyToClipboard(data, showToast)}
        buttonStyles={{marginTop: 20}}
        textContent={t('constants.copy')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
});
