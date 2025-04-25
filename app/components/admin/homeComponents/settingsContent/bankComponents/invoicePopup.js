import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useEffect, useState} from 'react';
import {copyToClipboard} from '../../../../../functions';
import {useNavigation} from '@react-navigation/native';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {breezLiquidReceivePaymentWrapper} from '../../../../../functions/breezLiquid';
import QrCodeWrapper from '../../../../../functions/CustomElements/QrWrapper';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import {useTranslation} from 'react-i18next';

export default function LiquidAddressModal() {
  const [receiveAddress, setReceiveAddress] = useState('');
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {t} = useTranslation();
  const navigate = useNavigation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function getReceiveAddress() {
      try {
        const addressResponse = await breezLiquidReceivePaymentWrapper({
          swapsAmounts: minMaxLiquidSwapAmounts,
          paymentType: 'liquid',
        });
        if (!addressResponse) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('settings.bank.popup.text1'),
          });
          return;
        }
        const {destination, receiveFeesSat} = addressResponse;
        setReceiveAddress(destination);
      } catch (err) {
        console.log(err);
      } finally {
        setIsLoading(false);
      }
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        getReceiveAddress();
      });
    });
  }, []);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <FullLoadingScreen />
      ) : (
        <TouchableOpacity
          onPress={() => {
            copyToClipboard(receiveAddress, navigate);
          }}>
          <QrCodeWrapper
            outerContainerStyle={{width: 275, height: 275}}
            innerContainerStyle={{width: 250, height: 250}}
            qrSize={250}
            QRData={!receiveAddress.length ? undefined : receiveAddress}
          />
        </TouchableOpacity>
      )}
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
