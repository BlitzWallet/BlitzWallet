import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { copyToClipboard } from '../../../../../functions';
import QrCodeWrapper from '../../../../../functions/CustomElements/QrWrapper';
import { useToast } from '../../../../../../context-store/toastManager';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../../../../constants';
import { useEffect } from 'react';

export default function CustomQrCode({ data, setContentHeight }) {
  const { showToast } = useToast();
  const { t } = useTranslation();
  useEffect(() => {
    setContentHeight(475);
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => {
          copyToClipboard(data, showToast);
        }}
      >
        <QrCodeWrapper
          outerContainerStyle={{
            width: 275,
            height: 275,
            backgroundColor: COLORS.darkModeText,
          }}
          innerContainerStyle={{ width: 250, height: 250 }}
          qrSize={250}
          QRData={data}
        />
      </TouchableOpacity>
      <CustomButton
        actionFunction={() => copyToClipboard(data, showToast)}
        buttonStyles={{ marginTop: 'auto' }}
        textContent={t('constants.copy')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
});
