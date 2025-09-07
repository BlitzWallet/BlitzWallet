import {Platform, StyleSheet, TouchableOpacity, View} from 'react-native';
import {CENTER, COLORS, SIZES} from '../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {copyToClipboard} from '../../../../functions';
import CustomButton from '../../../../functions/CustomElements/button';
import {ThemeText} from '../../../../functions/CustomElements';
import {useTranslation} from 'react-i18next';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {useToast} from '../../../../../context-store/toastManager';
import {useCallback} from 'react';

export default function ButtonsContainer(props) {
  const {showToast} = useToast();
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {t} = useTranslation();

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
            opacity: props.generatingInvoiceQRCode ? 0.5 : 1,
          }}
          actionFunction={() => {
            if (
              props.selectedRecieveOption?.toLowerCase() === 'lightning' &&
              !props.initialSendAmount &&
              !props.isUsingAltAccount
            ) {
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'chooseLNURLCopyFormat',
              });
              return;
            }
            if (props.generatingInvoiceQRCode) return;
            copyToClipboard(props.generatedAddress, showToast);
          }}
          textContent={t('constants.copy')}
        />
      </View>
      <TouchableOpacity
        onPress={() => {
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'switchReceiveOption',
            sliderHight: 0.8,
          });
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
    marginTop: 10,
    marginBottom: 30,
    overflow: 'hidden',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    columnGap: 10,
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
