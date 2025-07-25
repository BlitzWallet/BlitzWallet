import {View, TouchableOpacity, Image, Text, StyleSheet} from 'react-native';
import {CENTER, COLORS, FONT, ICONS, SIZES} from '../../../../../constants';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useNavigation} from '@react-navigation/native';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import {useGlobalContacts} from '../../../../../../context-store/globalContacts';
import GetThemeColors from '../../../../../hooks/themeColors';
import {ThemeText} from '../../../../../functions/CustomElements';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import ContactProfileImage from './profileImage';
import {useImageCache} from '../../../../../../context-store/imageCache';

export default function ProfilePageTransactions({transaction, currentTime}) {
  const profileInfo = transaction;
  const transactionData = transaction.transaction;
  const {cache} = useImageCache();

  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor, backgroundOffset} = GetThemeColors();

  const navigate = useNavigation();

  const endDate = currentTime;
  const startDate = transactionData.timestamp;

  const timeDifferenceMs = endDate - startDate;
  const timeDifferenceMinutes = timeDifferenceMs / (1000 * 60);
  const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60);
  const timeDifferenceDays = timeDifferenceMs / (1000 * 60 * 60 * 24);

  const paymentDescription = transactionData.description || '';

  return (
    <TouchableOpacity
      onPress={() => {
        //navigate to contacts page
        navigate.navigate('ExpandedContactsPage', {
          uuid: profileInfo.contactUUID,
        });
      }}
      key={transactionData.message.uuid}>
      {transactionData.message.didSend ||
      !transactionData.message.isRequest ||
      (transactionData.message.isRequest &&
        transactionData.message.isRedeemed != null) ? (
        <ConfirmedOrSentTransaction
          txParsed={transactionData.message}
          paymentDescription={paymentDescription}
          timeDifferenceMinutes={timeDifferenceMinutes}
          timeDifferenceHours={timeDifferenceHours}
          timeDifferenceDays={timeDifferenceDays}
          profileInfo={profileInfo}
          cache={cache}
        />
      ) : (
        <View style={{...styles.transactionContainer}}>
          <View
            style={{
              ...styles.selectImage,
              backgroundColor: backgroundOffset,
            }}>
            <ContactProfileImage
              updated={cache[profileInfo.contactUUID]?.updated}
              uri={cache[profileInfo.contactUUID]?.localUri}
              darkModeType={darkModeType}
              theme={theme}
            />
          </View>

          <View style={{width: '100%', flex: 1}}>
            <View style={styles.requestTextContianer}>
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.requestText}
                content={`Received request`}
              />

              <FormattedSatText
                frontText={'+'}
                styles={{
                  color: theme ? COLORS.darkModeText : COLORS.lightModeText,
                  includeFontPadding: false,
                }}
                balance={transactionData.message.amountMsat / 1000}
              />
            </View>
            <ThemeText
              styles={styles.dateText}
              content={`${
                timeDifferenceMinutes < 60
                  ? timeDifferenceMinutes < 1
                    ? ''
                    : Math.round(timeDifferenceMinutes)
                  : Math.round(timeDifferenceHours) < 24
                  ? Math.round(timeDifferenceHours)
                  : Math.round(timeDifferenceDays)
              } ${
                Math.round(timeDifferenceMinutes) < 60
                  ? timeDifferenceMinutes < 1
                    ? 'Just now'
                    : Math.round(timeDifferenceMinutes) === 1
                    ? 'minute'
                    : 'minutes'
                  : Math.round(timeDifferenceHours) < 24
                  ? Math.round(timeDifferenceHours) === 1
                    ? 'hour'
                    : 'hours'
                  : Math.round(timeDifferenceDays) === 1
                  ? 'day'
                  : 'days'
              } ${timeDifferenceMinutes > 1 ? 'ago' : ''}`}
            />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ConfirmedOrSentTransaction({
  txParsed,
  paymentDescription,
  timeDifferenceMinutes,
  timeDifferenceHours,
  timeDifferenceDays,
  profileInfo,
  cache,
}) {
  const {masterInfoObject} = useGlobalContextProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor, backgroundOffset} = GetThemeColors();
  const didDeclinePayment = txParsed.isRedeemed != null && !txParsed.isRedeemed;

  return (
    <View style={[styles.transactionContainer, {alignItems: 'center'}]}>
      {didDeclinePayment ? (
        <Image
          style={styles.icons}
          source={
            theme && darkModeType
              ? ICONS.failedTransactionWhite
              : ICONS.failedTransaction
          }
        />
      ) : (
        <View
          style={{
            width: 30,
            height: 30,
            marginRight: 5,
            alignItems: txParsed.didSend ? null : 'center',
            justifyContent: txParsed.didSend ? null : 'center',
          }}>
          {txParsed.didSend ? (
            <>
              <View
                style={{
                  ...styles.profileImageContainer,
                  backgroundColor: backgroundOffset,
                  bottom: 0,
                  left: 0,
                }}>
                <ContactProfileImage
                  updated={cache[masterInfoObject.uuid]?.updated}
                  uri={cache[masterInfoObject.uuid]?.localUri}
                  darkModeType={darkModeType}
                  theme={theme}
                />
              </View>
              <View
                style={{
                  ...styles.profileImageContainer,
                  backgroundColor: backgroundOffset,
                  zIndex: 1,
                  top: 0,
                  right: 0,
                }}>
                <ContactProfileImage
                  updated={cache[profileInfo.contactUUID]?.updated}
                  uri={cache[profileInfo.contactUUID]?.localUri}
                  darkModeType={darkModeType}
                  theme={theme}
                />
              </View>
            </>
          ) : (
            <View
              style={{
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 20,
                overflow: 'hidden',

                backgroundColor: backgroundOffset,
              }}>
              <ContactProfileImage
                updated={cache[profileInfo.contactUUID]?.updated}
                uri={cache[profileInfo.contactUUID]?.localUri}
                darkModeType={darkModeType}
                theme={theme}
              />
            </View>
          )}
        </View>
      )}

      <View style={{width: '100%', flex: 1}}>
        <ThemeText
          CustomEllipsizeMode={'tail'}
          CustomNumberOfLines={1}
          styles={{
            ...styles.descriptionText,
            color: didDeclinePayment
              ? theme && darkModeType
                ? textColor
                : COLORS.cancelRed
              : textColor,
            marginRight: 15,
          }}
          content={
            didDeclinePayment
              ? txParsed.didSend
                ? 'Request declined'
                : 'Declined request'
              : txParsed.isRequest
              ? txParsed.didSend
                ? txParsed.isRedeemed === null
                  ? 'Payment request sent'
                  : 'Request paid'
                : paymentDescription || 'Paid request'
              : !!paymentDescription
              ? paymentDescription
              : txParsed.didSend
              ? 'Sent'
              : 'Received'
          }
        />
        <ThemeText
          styles={{
            ...styles.dateText,
            color: didDeclinePayment
              ? theme && darkModeType
                ? textColor
                : COLORS.cancelRed
              : textColor,
          }}
          content={`${
            timeDifferenceMinutes < 60
              ? timeDifferenceMinutes < 1
                ? ''
                : Math.round(timeDifferenceMinutes)
              : Math.round(timeDifferenceHours) < 24
              ? Math.round(timeDifferenceHours)
              : Math.round(timeDifferenceDays)
          } ${
            Math.round(timeDifferenceMinutes) < 60
              ? timeDifferenceMinutes < 1
                ? 'Just now'
                : Math.round(timeDifferenceMinutes) === 1
                ? 'minute'
                : 'minutes'
              : Math.round(timeDifferenceHours) < 24
              ? Math.round(timeDifferenceHours) === 1
                ? 'hour'
                : 'hours'
              : Math.round(timeDifferenceDays) === 1
              ? 'day'
              : 'days'
          } ${timeDifferenceMinutes > 1 ? 'ago' : ''}`}
        />
      </View>

      <FormattedSatText
        frontText={
          didDeclinePayment ||
          masterInfoObject.userBalanceDenomination === 'hidden'
            ? ''
            : txParsed.didSend && !txParsed.isRequest
            ? '-'
            : '+'
        }
        containerStyles={{marginBottom: 'auto'}}
        styles={{
          ...styles.amountText,
          color: didDeclinePayment
            ? theme && darkModeType
              ? textColor
              : COLORS.cancelRed
            : textColor,
          includeFontPadding: false,
        }}
        balance={txParsed.amountMsat / 1000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  transactionContainer: {
    width: '95%',
    flexDirection: 'row',
    alignItems: 'start',
    marginVertical: 12.5,
    ...CENTER,
  },
  selectImage: {
    width: 30,
    height: 30,

    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginRight: 5,
    overflow: 'hidden',
  },
  requestTextContianer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestText: {
    flex: 1,
    marginRight: 5,
  },
  icons: {
    width: 30,
    height: 30,
    marginRight: 5,
  },

  descriptionText: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    fontWeight: 400,
  },
  dateText: {
    fontFamily: FONT.Title_light,
    fontSize: SIZES.small,
  },
  amountText: {
    marginLeft: 'auto',
    fontFamily: FONT.Title_Regular,
    marginBottom: 'auto',
    fontWeight: 400,
  },

  profileImageContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 20,
    overflow: 'hidden',
    position: 'absolute',
  },
});
