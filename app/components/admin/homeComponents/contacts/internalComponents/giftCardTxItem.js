import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import {CENTER, COLORS, SIZES} from '../../../../../constants';
import FastImage from 'react-native-fast-image';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';

export default function GiftCardTxItem({
  txParsed,
  isOutgoingPayment,
  theme,
  darkModeType,
  backgroundOffset,
  textColor,
  t,
  timeDifference,
  isFromProfile,
  navigate,
  masterInfoObject,
}) {
  const giftCardName = txParsed.giftCardInfo?.name;

  return (
    <TouchableOpacity
      disabled={isFromProfile}
      onPress={() => {
        if (!navigate) return;
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'viewContactsGiftInfo',
          giftCardInfo: txParsed.giftCardInfo,
          from: 'txItem',
          sliderHight: 1,
          isOutgoingPayment,
        });
      }}
      style={styles.transactionContainer}>
      {/* Gift Card Logo with subtle styling */}
      <View
        style={[
          styles.logoContainer,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.lightGray,
            // Add a subtle border/shadow for distinction
            borderWidth: theme ? 0.5 : 2,
            borderColor: backgroundOffset,
          },
        ]}>
        <FastImage
          style={styles.cardLogo}
          source={{uri: txParsed.giftCardInfo.logo}}
          resizeMode={FastImage.resizeMode.contain}
        />
      </View>

      <View style={{width: '100%', flex: 1}}>
        {/* Gift card name with subtle emphasis */}
        <ThemeText
          CustomEllipsizeMode={'tail'}
          CustomNumberOfLines={1}
          styles={styles.giftCardNameText}
          content={giftCardName}
        />

        {/* Transaction type with gift card context */}
        <ThemeText
          CustomEllipsizeMode={'tail'}
          CustomNumberOfLines={1}
          styles={styles.descriptionText}
          content={
            isOutgoingPayment
              ? `${t('transactionLabelText.sent')} • ${t(
                  'contacts.internalComponents.viewAllGiftCards.cardNamePlaceH',
                )}`
              : `${t('transactionLabelText.received')} • ${t(
                  'contacts.internalComponents.viewAllGiftCards.cardNamePlaceH',
                )}`
          }
        />
        <ThemeText styles={styles.dateText} content={timeDifference} />
      </View>

      <FormattedSatText
        frontText={
          masterInfoObject.userBalanceDenomination === 'hidden'
            ? ''
            : isOutgoingPayment
            ? '-'
            : '+'
        }
        containerStyles={{
          marginBottom: 'auto',
        }}
        styles={styles.amountText}
        balance={txParsed.amountMsat}
        useMillionDenomination={true}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  transactionContainer: {
    width: '95%',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12.5,
    ...CENTER,
  },
  logoContainer: {
    width: 50,
    height: 50,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    padding: 6,
    overflow: 'visible', // Allow overlay to show
    marginRight: 15,
    position: 'relative',
  },
  cardLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },

  giftCardNameText: {
    marginRight: 15,
    includeFontPadding: false,
  },
  descriptionText: {
    fontSize: SIZES.small,
    opacity: 0.8,
    includeFontPadding: false,
  },
  dateText: {
    fontSize: SIZES.small,
    fontWeight: 300,
    opacity: 0.7,
  },
  amountText: {
    fontWeight: 400,
    includeFontPadding: false,
  },
});
