import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { CENTER } from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { copyToClipboard } from '../../functions';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import { useToast } from '../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import ThemeIcon from '../../functions/CustomElements/themeIcon';

export default function TechnicalTransactionDetails(props) {
  console.log('Transaction Detials Page');
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { t } = useTranslation();
  useHandleBackPressNew();

  const { transaction } = props.route.params;

  const { details, sparkID } = transaction;

  const isPending = transaction.paymentStatus === 'pending';

  const paymentDetails =
    transaction.paymentType === 'spark'
      ? details.isLRC20Payment
        ? [t('screens.inAccount.technicalTransactionDetails.txHash')]
        : [t('screens.inAccount.technicalTransactionDetails.paymentId')]
      : transaction.paymentType === 'lightning'
      ? [
          t('screens.inAccount.technicalTransactionDetails.paymentId'),
          t('screens.inAccount.technicalTransactionDetails.preimage'),
          t('screens.inAccount.technicalTransactionDetails.address'),
        ]
      : [
          t('screens.inAccount.technicalTransactionDetails.paymentId'),
          t('screens.inAccount.technicalTransactionDetails.bitcoinTxId'),
          t('screens.inAccount.technicalTransactionDetails.address'),
          t('screens.inAccount.technicalTransactionDetails.paymentExp'),
        ].slice(0, details.direction === 'OUTGOING' && isPending ? 4 : 3);

  const infoElements = paymentDetails.map((item, id) => {
    const txItem =
      transaction.paymentType === 'spark'
        ? sparkID
        : transaction.paymentType === 'lightning'
        ? id === 0
          ? sparkID
          : id === 1
          ? details.preimage
          : details.address
        : id === 0
        ? sparkID
        : id === 1
        ? details.onChainTxid
        : id === 2
        ? details.address
        : details.expiresAt || 'N/A';

    return (
      <View key={id}>
        <View style={styles.headerContainer}>
          <ThemeText content={item} styles={{ ...styles.headerText }} />
          {!isPending && !txItem && (
            <TouchableOpacity
              onPress={() => {
                navigate.navigate('InformationPopup', {
                  textContent: t(
                    'screens.inAccount.technicalTransactionDetails.noInformationLabel',
                    { item },
                  ),
                  buttonText: t('constants.understandText'),
                });
              }}
            >
              <ThemeIcon size={20} iconName={'Info'} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => {
            if (
              transaction.paymentType === 'bitcoin' &&
              item ===
                t('screens.inAccount.technicalTransactionDetails.bitcoinTxId')
            ) {
              navigate.navigate('CustomWebView', {
                webViewURL: `https://mempool.space/tx/${txItem}`,
              });
              return;
            }
            copyToClipboard(txItem, showToast);
          }}
        >
          <ThemeText
            CustomNumberOfLines={2}
            content={txItem || 'N/A'}
            styles={{ ...styles.descriptionText }}
          />
        </TouchableOpacity>
      </View>
    );
  });

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.innerContainer}
      >
        {infoElements}
        {/* {transaction.paymentType === 'spark' && (
          <ThemeText
            content={t(
              'screens.inAccount.technicalTransactionDetails.privacyMessage',
              {
                type: t(
                  `screens.inAccount.technicalTransactionDetails.${
                    details?.direction === 'OUTGOING' ? 'receivers' : 'senders'
                  }`,
                ),
              },
            )}
          />
        )} */}
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    width: '95%',
    ...CENTER,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  headerText: { includeFontPadding: false, marginRight: 5 },
  descriptionText: {
    marginBottom: 30,
  },
});
