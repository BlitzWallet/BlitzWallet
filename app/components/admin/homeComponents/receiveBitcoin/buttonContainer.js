import {Platform, StyleSheet, TouchableOpacity, View} from 'react-native';
import {CENTER, COLORS, SIZES} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {copyToClipboard} from '../../../../functions';
import CustomButton from '../../../../functions/CustomElements/button';
import {ThemeText} from '../../../../functions/CustomElements';
import {useTranslation} from 'react-i18next';
import {useGlobalThemeContext} from '../../../../../context-store/theme';

export default function ButtonsContainer(props) {
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {t} = useTranslation();
  return (
    <View style={styles.buttonContainer}>
      <View style={styles.buttonRow}>
        <CustomButton
          buttonStyles={{...styles.mainButtons, marginRight: 10}}
          actionFunction={() =>
            navigate.navigate('EditReceivePaymentInformation', {
              from: 'receivePage',
            })
          }
          textContent={t('constants.edit')}
        />
        <CustomButton
          buttonStyles={{
            ...styles.mainButtons,
            opacity: props.generatingInvoiceQRCode ? 0.5 : 1,
          }}
          actionFunction={() => {
            if (props.generatingInvoiceQRCode) return;
            copyToClipboard(props.generatedAddress, navigate);
          }}
          textContent={t('constants.copy')}
        />
      </View>
      <TouchableOpacity
        onPress={() => {
          navigate.navigate('SwitchReceiveOptionPage');
        }}
        style={[
          styles.secondaryButton,
          {borderColor: theme ? COLORS.darkModeText : COLORS.lightModeText},
        ]}>
        <ThemeText
          styles={styles.secondaryButtonText}
          content={t('wallet.receivePages.buttonContainer.format')}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    width: '100%',

    marginVertical: 30,
    overflow: 'hidden',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  mainButtons: {
    width: 125,
    maxWidth: '45%',
  },

  secondaryButton: {
    width: 'auto',
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    ...CENTER,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    paddingHorizontal: 12,
    includeFontPadding: false,
    paddingVertical: 5,
  },
});
