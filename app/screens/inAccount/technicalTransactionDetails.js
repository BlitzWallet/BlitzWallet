import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { CENTER } from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { copyToClipboard } from '../../functions';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { useToast } from '../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { INSET_WINDOW_WIDTH } from '../../constants/theme';

export default function TechnicalTransactionDetails(props) {
  console.log('Transaction Details Page');
  const { showToast } = useToast();
  const navigate = useNavigation();
  const { t } = useTranslation();

  const { transaction } = props.route.params;
  const { details, sparkID } = transaction;

  const isPending = transaction.paymentStatus === 'pending';

  let paymentDetails = [];
  let infoValues = [];

  if (transaction.paymentType === 'spark') {
    if (details.isFlashnetStablecoin) {
      paymentDetails = [
        t('screens.inAccount.technicalTransactionDetails.paymentId'),
        t('screens.inAccount.technicalTransactionDetails.quoteId'),
        t('screens.inAccount.technicalTransactionDetails.destinationAddress'),
        t('screens.inAccount.technicalTransactionDetails.destinationAsset'),
        t('screens.inAccount.technicalTransactionDetails.destinationChain'),
      ];
      infoValues = [
        sparkID,
        details.quoteId,
        details.destinationAddress,
        details.destinationAsset,
        details.destinationChain,
      ];
    } else if (details.isLRC20Payment) {
      paymentDetails = [
        t('screens.inAccount.technicalTransactionDetails.txHash'),
      ];
      infoValues = [sparkID];
    } else {
      paymentDetails = [
        t('screens.inAccount.technicalTransactionDetails.paymentId'),
      ];
      infoValues = [sparkID];
    }
  } else if (transaction.paymentType === 'lightning') {
    paymentDetails = [
      t('screens.inAccount.technicalTransactionDetails.paymentId'),
      t('screens.inAccount.technicalTransactionDetails.preimage'),
      t('screens.inAccount.technicalTransactionDetails.address'),
    ];
    infoValues = [sparkID, details.preimage, details.address];
  } else {
    // bitcoin
    const bitcoinLabels = [
      t('screens.inAccount.technicalTransactionDetails.paymentId'),
      t('screens.inAccount.technicalTransactionDetails.bitcoinTxId'),
      t('screens.inAccount.technicalTransactionDetails.address'),
      t('screens.inAccount.technicalTransactionDetails.paymentExp'),
    ];
    const bitcoinValues = [
      sparkID,
      details.onChainTxid,
      details.address,
      details.expiresAt || 'N/A',
    ];
    const count = details.direction === 'OUTGOING' && isPending ? 4 : 3;
    paymentDetails = bitcoinLabels.slice(0, count);
    infoValues = bitcoinValues.slice(0, count);
  }

  const infoElements = paymentDetails.map((item, id) => {
    const txItem = infoValues[id];

    const isBitcoinTxId =
      transaction.paymentType === 'bitcoin' &&
      item === t('screens.inAccount.technicalTransactionDetails.bitcoinTxId');

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
            if (isBitcoinTxId) {
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
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    width: INSET_WINDOW_WIDTH,
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
