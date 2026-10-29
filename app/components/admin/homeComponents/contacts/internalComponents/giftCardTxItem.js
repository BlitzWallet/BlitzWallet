import { StyleSheet, View } from 'react-native';
import { CENTER } from '../../../../../constants';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import DiscText from '../../../../../functions/CustomElements/redesign/DiscText';

export default function GiftCardTxItem({
  txParsed,
  isOutgoingPayment,
  t,
  timeDifference,
  isFromProfile,
  navigate,
  masterInfoObject,
}) {
  const giftCardName =
    txParsed.giftCardInfo?.name ||
    t('contacts.internalComponents.viewAllGiftCards.cardNamePlaceH');

  return (
    <View style={styles.transactionContainer}>
      <ListRow
        onPress={
          isFromProfile
            ? undefined
            : () => {
                if (!navigate) return;
                navigate.navigate('ViewGiftCardCode', {
                  giftCardInfo: txParsed.giftCardInfo,
                  message: txParsed.description,
                  from: 'txItem',
                  isOutgoingPayment,
                });
              }
        }
        minHeight={64}
        titleStyle={styles.title}
        titleLines={2}
        subLines={1}
        lead={
          <DiscText
            text={giftCardName.trim().charAt(0).toUpperCase() || '?'}
            size={40}
            fontSize={15}
          />
        }
        title={t('contacts.internalComponents.viewAllGiftCards.cardTitle', {
          store: giftCardName,
        })}
        sub={`${t(
          isOutgoingPayment
            ? 'transactionLabelText.sent'
            : 'transactionLabelText.received',
        )} • ${timeDifference}`}
        trailing={
          <FormattedSatText
            frontText={
              masterInfoObject.userBalanceDenomination === 'hidden'
                ? ''
                : isOutgoingPayment
                ? '-'
                : '+'
            }
            styles={styles.amount}
            balance={txParsed.amountMsat}
            useMillionDenomination={true}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  transactionContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: { fontSize: 15, lineHeight: 21 },
  amount: { fontSize: 15, includeFontPadding: false },
});
