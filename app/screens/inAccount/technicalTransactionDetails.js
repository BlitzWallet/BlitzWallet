import {StyleSheet, View, TouchableOpacity, Image} from 'react-native';
import {CENTER, ICONS} from '../../constants';
import {useNavigation} from '@react-navigation/native';
import {copyToClipboard} from '../../functions';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import {WINDOWWIDTH} from '../../constants/theme';
import ThemeImage from '../../functions/CustomElements/themeImage';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';

export default function TechnicalTransactionDetails(props) {
  console.log('Transaction Detials Page');
  const navigate = useNavigation();
  useHandleBackPressNew();

  const {selectedTX, isLiquidPayment, isFailedPayment, isEcashPayment} =
    props.route.params;

  const isAClosedChannelTx = selectedTX.description
    ?.toLowerCase()
    ?.includes('closed channel');

  const paymentDetails = isEcashPayment
    ? ['Mint url', 'Payment Preimage']
    : isFailedPayment
    ? ['Payment Hash', 'Payment Preimage', 'Destination Pubkey']
    : isLiquidPayment
    ? ['Destination', 'Transaction Id']
    : isAClosedChannelTx
    ? ['Closing TxId', 'Funding TxId', 'Short Channel Id']
    : ['Payment Hash', 'Payment Preimage', 'Destination Pubkey'];

  const infoElements = paymentDetails.map((item, id) => {
    const txItem = isEcashPayment
      ? id === 0
        ? selectedTX?.mintURL
        : selectedTX?.preImage || ''
      : isFailedPayment
      ? id === 0
        ? selectedTX?.details?.data?.paymentHash
        : id === 1
        ? selectedTX?.details?.data?.paymentPreimage
        : selectedTX?.details?.data?.destinationPubkey
      : isLiquidPayment
      ? id === 0
        ? selectedTX?.destination
        : selectedTX?.txId
      : isAClosedChannelTx
      ? id === 0
        ? selectedTX.details?.data?.closingTxid
        : id === 1
        ? selectedTX.details?.data?.fundingTxid
        : selectedTX.details?.data?.shortChannelId
      : id === 0
      ? selectedTX.details?.data?.paymentHash
      : id === 1
      ? selectedTX.details?.data?.paymentPreimage
      : selectedTX.details?.data?.destinationPubkey;
    return (
      <View key={id}>
        <ThemeText content={item} styles={{...styles.headerText}} />
        <TouchableOpacity
          onPress={() => {
            if (isLiquidPayment && item === 'Transaction Id') {
              navigate.navigate('CustomWebView', {
                webViewURL: `https://liquid.network/tx/${txItem}`,
              });
              return;
            }
            copyToClipboard(txItem, navigate);
          }}>
          <ThemeText content={txItem} styles={{...styles.descriptionText}} />
        </TouchableOpacity>
      </View>
    );
  });

  return (
    <GlobalThemeView>
      <View style={{flex: 1, width: WINDOWWIDTH, ...CENTER}}>
        <TouchableOpacity
          onPress={() => {
            navigate.goBack();
          }}>
          <ThemeImage
            darkModeIcon={ICONS.smallArrowLeft}
            lightModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />
        </TouchableOpacity>
        <View style={styles.innerContainer}>{infoElements}</View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: '95%',
    paddingTop: 50,
    ...CENTER,
  },
  headerText: {
    marginBottom: 5,
  },
  descriptionText: {
    marginBottom: 30,
  },
});
