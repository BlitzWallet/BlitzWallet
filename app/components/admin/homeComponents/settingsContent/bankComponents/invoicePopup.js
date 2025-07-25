import {ScrollView, StyleSheet, TouchableOpacity} from 'react-native';
import {copyToClipboard} from '../../../../../functions';
import QrCodeWrapper from '../../../../../functions/CustomElements/QrWrapper';
import {useToast} from '../../../../../../context-store/toastManager';
import CustomButton from '../../../../../functions/CustomElements/button';

export default function CustomQrCode({data}) {
  const {showToast} = useToast();

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
        textContent={'Copy'}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
