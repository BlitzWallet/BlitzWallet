import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, SIZES } from '../../../../constants';
import { useNavigation } from '@react-navigation/native';
import { copyToClipboard } from '../../../../functions';
import CustomButton from '../../../../functions/CustomElements/button';
import { ThemeText } from '../../../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../../context-store/toastManager';
import { useCallback } from 'react';
import { HIDDEN_OPACITY } from '../../../../constants/theme';

export default function ButtonsContainer(props) {
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { t } = useTranslation();

  const editAmount = useCallback(() => {
    if (
      props.selectedRecieveOption?.toLowerCase() === 'spark' ||
      props.selectedRecieveOption?.toLowerCase() === 'rootstock'
    ) {
      navigate.navigate('InformationPopup', {
        textContent: t('wallet.receivePages.buttonContainer.infoMessage'),
        buttonText: t('constants.understandText'),
      });
      return;
    }
    navigate.navigate('EditReceivePaymentInformation', {
      from: 'receivePage',
      receiveType: props.selectedRecieveOption,
    });
  }, [props, navigate]);
  return (
    <View style={styles.buttonContainer}>
      <View style={styles.buttonRow}>
        <CustomButton
          buttonStyles={styles.mainButtons}
          actionFunction={editAmount}
          textContent={t('constants.amount')}
        />
        <CustomButton
          buttonStyles={{
            ...styles.mainButtons,
            opacity: props.generatingInvoiceQRCode ? HIDDEN_OPACITY : 1,
          }}
          actionFunction={() => {
            if (props.generatingInvoiceQRCode) return;
            copyToClipboard(props.generatedAddress, showToast);
          }}
          textContent={t('constants.copy')}
        />
      </View>
      <TouchableOpacity
        style={styles.switchButton}
        onPress={() => {
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'switchReceiveOption',
            sliderHight: 0.8,
          });
        }}
      >
        <ThemeText
          styles={styles.switchButtonText}
          content={t('wallet.receivePages.buttonContainer.format')}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    maxWidth: 300,
    width: '100%',
    marginTop: 10,
    marginBottom: 30,
    overflow: 'hidden',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 10,
  },
  mainButtons: {
    flexShrink: 1,
    width: '100%',
  },

  secondaryButton: {
    borderRadius: 8,
    borderBottomWidth: 1,
    ...CENTER,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    paddingHorizontal: 10,
    includeFontPadding: false,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 20,
  },
  switchButtonText: {
    fontSize: SIZES.medium,
    textDecorationLine: 'underline',
  },
});
