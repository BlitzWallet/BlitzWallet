import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import { CENTER } from '../../../../../constants';
import GetThemeColors from '../../../../../hooks/themeColors';
import formatSparkPaymentAddress from '../functions/formatSparkPaymentAddress';
import { useNavigation } from '@react-navigation/native';
import { InputTypes } from 'bitcoin-address-parser';
import ContactProfileImage from '../../contacts/internalComponents/profileImage';

export default function InvoiceInfo({
  paymentInfo,
  fromPage,
  contactInfo,
  theme,
  darkModeType,
}) {
  const formmateedSparkPaymentInfo = formatSparkPaymentAddress(paymentInfo);
  const { backgroundOffset, backgroundColor } = GetThemeColors();
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
      {fromPage === 'contacts' ? (
        <View style={styles.contactRow}>
          <View
            style={[
              styles.profileImage,
              {
                backgroundColor: backgroundColor,
              },
            ]}
          >
            <ContactProfileImage
              updated={contactInfo?.imageData?.updated}
              uri={contactInfo?.imageData?.localUri}
              darkModeType={darkModeType}
              theme={theme}
            />
          </View>
          <ThemeText
            styles={styles.addressText}
            CustomNumberOfLines={1}
            content={contactInfo?.name || ''}
          />
        </View>
      ) : (
        <ThemeText
          styles={{ includeFontPadding: false }}
          CustomNumberOfLines={2}
          content={
            paymentInfo?.type === InputTypes.LNURL_PAY
              ? paymentInfo.data.address
              : formmateedSparkPaymentInfo.address
          }
        />
      )}
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
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  addressText: {
    includeFontPadding: false,
    flexShrink: 1,
  },
});
