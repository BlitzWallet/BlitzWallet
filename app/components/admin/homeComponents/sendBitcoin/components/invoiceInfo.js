import { StyleSheet, TouchableOpacity } from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import { CENTER } from '../../../../../constants';
import GetThemeColors from '../../../../../hooks/themeColors';
import formatSparkPaymentAddress from '../functions/formatSparkPaymentAddress';
import { useNavigation } from '@react-navigation/native';
import { InputTypes } from 'bitcoin-address-parser';

export default function InvoiceInfo({ paymentInfo }) {
  const formmateedSparkPaymentInfo = formatSparkPaymentAddress(paymentInfo);
  const { backgroundOffset } = GetThemeColors();
  const navigate = useNavigation();
  return (
    <TouchableOpacity
      onPress={() => {
        navigate.navigate('ErrorScreen', {
          errorMessage: formmateedSparkPaymentInfo.address,
        });
      }}
      style={[
        styles.invoiceContainer,
        {
          backgroundColor: backgroundOffset,
        },
      ]}
    >
      <ThemeText
        CustomNumberOfLines={2}
        content={
          paymentInfo?.type === InputTypes.LNURL_PAY
            ? paymentInfo.data.address
            : formmateedSparkPaymentInfo.address
        }
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  invoiceContainer: {
    width: '80%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    ...CENTER,
    marginTop: 30,
  },
});
