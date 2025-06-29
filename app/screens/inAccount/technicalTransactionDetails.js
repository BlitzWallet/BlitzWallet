import {StyleSheet, View, TouchableOpacity, ScrollView} from 'react-native';
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

  const {transaction} = props.route.params;

  const {details, sparkID} = transaction;

  const paymentDetails =
    transaction.paymentType === 'spark'
      ? ['Payment Id', 'Sender Public Key', 'Payment Address']
      : transaction.paymentType === 'lightning'
      ? ['Payment Id', 'Payment Preimage', 'Payment Address']
      : ['Payment Id', 'Bitcoin Txid', 'Payment Address'];

  const infoElements = paymentDetails.map((item, id) => {
    const txItem =
      transaction.paymentType === 'spark'
        ? id === 0
          ? sparkID
          : id === 1
          ? details.senderIdentityPublicKey
          : details.address
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
        : details.address;

    return (
      <View key={id}>
        <ThemeText content={item} styles={{...styles.headerText}} />
        <TouchableOpacity
          onPress={() => {
            if (
              transaction.paymentType === 'bitcoin' &&
              item === 'Bitcoin Txid'
            ) {
              navigate.navigate('CustomWebView', {
                webViewURL: `https://mempool.space/tx/${txItem}`,
              });
              return;
            }
            copyToClipboard(txItem, navigate);
          }}>
          <ThemeText
            content={txItem || 'N/A'}
            styles={{...styles.descriptionText}}
          />
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.innerContainer}>
          {infoElements}
        </ScrollView>
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
