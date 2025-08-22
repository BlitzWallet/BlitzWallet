import React, {useCallback, useState, useMemo} from 'react';
import {View, TouchableOpacity, Image, StyleSheet} from 'react-native';
import {CENTER, COLORS, FONT, ICONS, SIZES} from '../../../../../constants';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useNavigation} from '@react-navigation/native';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {ThemeText} from '../../../../../functions/CustomElements';
import {getDataFromCollection, updateMessage} from '../../../../../../db';
import {getFiatRates} from '../../../../../functions/SDK';
import {sendPushNotification} from '../../../../../functions/messaging/publishMessage';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {useKeysContext} from '../../../../../../context-store/keys';
import getReceiveAddressForContactPayment from './getReceiveAddressAndKindForPayment';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useServerTimeOnly} from '../../../../../../context-store/serverTime';
import {useTranslation} from 'react-i18next';

function getTimeDisplay(
  timeDifferenceMinutes,
  timeDifferenceHours,
  timeDifferenceDays,
  timeDifferenceYears,
  t,
) {
  const timeValue =
    timeDifferenceMinutes <= 60
      ? timeDifferenceMinutes < 1
        ? ''
        : Math.round(timeDifferenceMinutes)
      : timeDifferenceHours <= 24
      ? Math.round(timeDifferenceHours)
      : timeDifferenceDays <= 365
      ? Math.round(timeDifferenceDays)
      : Math.round(timeDifferenceYears);

  const timeUnit =
    timeDifferenceMinutes <= 60
      ? timeDifferenceMinutes < 1
        ? t('transactionLabelText.txTime_just_now')
        : Math.round(timeDifferenceMinutes) === 1
        ? t('timeLabels.minute')
        : t('timeLabels.minutes')
      : timeDifferenceHours <= 24
      ? Math.round(timeDifferenceHours) === 1
        ? t('timeLabels.hour')
        : t('timeLabels.hours')
      : timeDifferenceDays <= 365
      ? Math.round(timeDifferenceDays) === 1
        ? t('timeLabels.day')
        : t('timeLabels.days')
      : Math.round(timeDifferenceYears) === 1
      ? t('timeLabels.year')
      : t('timeLabels.years');

  const suffix =
    timeDifferenceMinutes > 1 ? ` ${t('transactionLabelText.ago')}` : '';

  return `${timeValue}${
    timeUnit === t('transactionLabelText.txTime_just_now') ? '' : ' '
  }${timeUnit}${suffix}`;
}

function ConfirmedOrSentTransaction({
  txParsed,
  paymentDescription,
  timeDifferenceMinutes,
  timeDifferenceHours,
  timeDifferenceDays,
  timeDifferenceYears,
  props,
}) {
  const {t} = useTranslation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {textColor} = GetThemeColors();

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
        <ThemeImage
          styles={{
            ...styles.icons,
            transform: [
              {
                rotate: didDeclinePayment
                  ? '180deg'
                  : txParsed.didSend && !txParsed.isRequest
                  ? '90deg'
                  : '270deg',
              },
            ],
          }}
          darkModeIcon={ICONS.smallArrowLeft}
          lightModeIcon={ICONS.smallArrowLeft}
          lightsOutIcon={ICONS.arrow_small_left_white}
        />
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
                ? t('transactionLabelText.requestDeclined')
                : t('transactionLabelText.declinedRequest')
              : txParsed.isRequest
              ? txParsed.didSend
                ? txParsed.isRedeemed === null
                  ? t('transactionLabelText.requestSent')
                  : t('transactionLabelText.requestPaid')
                : paymentDescription || t('transactionLabelText.paidRequest')
              : !!paymentDescription
              ? paymentDescription
              : txParsed.didSend
              ? t('transactionLabelText.sent')
              : t('transactionLabelText.received')
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
          content={getTimeDisplay(
            timeDifferenceMinutes,
            timeDifferenceHours,
            timeDifferenceDays,
            timeDifferenceYears,
            t,
          )}
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
        containerStyles={{
          marginBottom: 'auto',
        }}
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
        useMillionDenomination={true}
      />
    </View>
  );
}

export default function ContactsTransactionItem(props) {
  const {selectedContact, transaction, myProfile, currentTime} = props;
  const {t} = useTranslation();
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {theme, darkModeType} = useGlobalThemeContext();
  const {textColor, backgroundColor} = GetThemeColors();
  const navigate = useNavigation();
  const getServerTime = useServerTimeOnly();

  const [isLoading, setIsLoading] = useState({
    sendBTN: false,
    declineBTN: false,
  });

  // Memoized calculations
  const timeCalculations = useMemo(() => {
    const endDate = currentTime;
    const startDate = transaction.timestamp;

    const timeDifferenceMs = Math.abs(endDate - startDate);

    return {
      timeDifferenceMinutes: timeDifferenceMs / (1000 * 60),
      timeDifferenceHours: timeDifferenceMs / (1000 * 60 * 60),
      timeDifferenceDays: timeDifferenceMs / (1000 * 60 * 60 * 24),
      timeDifferenceYears: timeDifferenceMs / (1000 * 60 * 60 * 24 * 365),
    };
  }, [currentTime, transaction.serverTimestamp, transaction.timestamp]);

  const {
    timeDifferenceMinutes,
    timeDifferenceHours,
    timeDifferenceDays,
    timeDifferenceYears,
  } = timeCalculations;

  const txParsed = transaction.message;
  const paymentDescription = txParsed?.description || '';

  const updatePaymentStatus = useCallback(
    async (transaction, usingOnPage, didPay) => {
      try {
        usingOnPage &&
          setIsLoading(prev => ({
            ...prev,
            [didPay ? 'sendBTN' : 'declineBTN']: true,
          }));
        let newMessage = {
          ...transaction.message,
          isRedeemed: didPay,
        };
        delete newMessage.didSend;
        delete newMessage.wasSeen;
        const [fiatCurrencies, retrivedContact] = await Promise.all([
          getFiatRates(),
          getDataFromCollection('blitzWalletUsers', selectedContact.uuid),
        ]);
        if (!retrivedContact)
          throw new Error(t('errormessages.userDataFetchError'));

        const currentTime = getServerTime();

        const useNewNotifications = !!retrivedContact.isUsingNewNotifications;

        const [didPublishNotification, didUpdateMessage] = await Promise.all([
          sendPushNotification({
            selectedContactUsername: selectedContact.uniqueName,
            myProfile: myProfile,
            data: {
              isUpdate: true,
              [useNewNotifications ? 'option' : 'message']: useNewNotifications
                ? didPay
                  ? 'paid'
                  : 'declined'
                : t(
                    'contacts.internalComponents.contactsTransactions.pushNotificationUpdateMessage',
                    {
                      name: myProfile.name || myProfile.uniqueName,
                      option: didPay
                        ? t('transactionLabelText.paidLower')
                        : t('transactionLabelText.declinedLower'),
                    },
                  ),
            },
            fiatCurrencies: fiatCurrencies,
            privateKey: contactsPrivateKey,
            retrivedContact,
          }),

          retrivedContact.isUsingEncriptedMessaging
            ? updateMessage({
                newMessage,
                fromPubKey: publicKey,
                toPubKey: selectedContact.uuid,
                retrivedContact,
                privateKey: contactsPrivateKey,
                currentTime,
              })
            : updateMessage({
                newMessage,
                fromPubKey: transaction.fromPubKey,
                toPubKey: transaction.toPubKey,
                retrivedContact,
                privateKey: contactsPrivateKey,
                currentTime,
              }),
        ]);
        if (!didUpdateMessage && usingOnPage) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('errormessages.updateContactMessageError'),
          });
        }
      } catch (err) {
        console.log(err);
        if (!usingOnPage) return;
        navigate.navigate('ErrorScreen', {
          errorMessage: t('errormessages.declinePaymentError'),
        });
      } finally {
        if (!usingOnPage) return;
        setIsLoading(prev => ({
          ...prev,
          [didPay ? 'sendBTN' : 'declineBTN']: false,
        }));
      }
    },
    [
      selectedContact,
      myProfile,
      contactsPrivateKey,
      publicKey,
      getServerTime,
      navigate,
    ],
  );

  const acceptPayRequest = useCallback(
    async (transaction, selectedContact) => {
      setIsLoading(prev => ({
        ...prev,
        sendBTN: true,
      }));
      const sendingAmount = transaction.message.amountMsat / 1000;

      const myProfileMessage = t(
        'contacts.internalComponents.contactsTransactions.acceptProfileMessage',
        {
          name: selectedContact.name || selectedContact.uniqueName,
        },
      );
      const payingContactMessage = t(
        'contacts.internalComponents.contactsTransactions.acceptPayingContactMessage',
        {
          name: selectedContact.name || selectedContact.uniqueName,
        },
      );

      const receiveAddress = await getReceiveAddressForContactPayment(
        sendingAmount,
        selectedContact,
        myProfileMessage,
        payingContactMessage,
      );
      if (!receiveAddress.didWork) {
        navigate.navigate('ErrorScreen', {
          errorMessage: receiveAddress.error,
          useTranslationString: true,
        });
        return;
      }
      setIsLoading(prev => ({
        ...prev,
        sendBTN: false,
      }));
      navigate.navigate('ConfirmPaymentScreen', {
        btcAdress: receiveAddress.receiveAddress,
        comingFromAccept: true,
        enteredPaymentInfo: {
          amount: sendingAmount,
          description: myProfileMessage,
        },
        fromPage: 'contacts',
        publishMessageFunc: () => updatePaymentStatus(transaction, false, true),
      });
      return;
    },
    [myProfile, navigate, updatePaymentStatus],
  );

  if (txParsed === undefined) return;

  const isCompletedTransaction =
    txParsed.didSend ||
    !txParsed.isRequest ||
    (txParsed.isRequest && txParsed.isRedeemed != null);

  return (
    <TouchableOpacity
      onPress={() => {
        if (!paymentDescription) return;
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'expandedContactMessage',
          sliderHight: 0.3,
          message: paymentDescription,
        });
      }}
      key={props.id}
      activeOpacity={1}>
      {isCompletedTransaction ? (
        <ConfirmedOrSentTransaction
          txParsed={txParsed}
          paymentDescription={paymentDescription}
          timeDifferenceMinutes={timeDifferenceMinutes}
          timeDifferenceHours={timeDifferenceHours}
          timeDifferenceDays={timeDifferenceDays}
          timeDifferenceYears={timeDifferenceYears}
          props={props}
        />
      ) : (
        <View style={styles.transactionContainer}>
          <ThemeImage
            styles={{
              ...styles.icons,
              transform: [
                {
                  rotate: '270deg',
                },
              ],
            }}
            darkModeIcon={ICONS.smallArrowLeft}
            lightModeIcon={ICONS.smallArrowLeft}
            lightsOutIcon={ICONS.arrow_small_left_white}
          />

          <View style={{width: '100%', flex: 1}}>
            <FormattedSatText
              frontText={t(
                'contacts.internalComponents.contactsTransactions.requestTitle',
              )}
              neverHideBalance={true}
              containerStyles={styles.requestTextContainer}
              styles={{
                color: theme ? COLORS.darkModeText : COLORS.lightModeText,
                includeFontPadding: false,
              }}
              balance={txParsed.amountMsat / 1000}
            />

            <ThemeText
              styles={{
                ...styles.dateText,
                marginBottom: paymentDescription ? 0 : 15,
              }}
              content={getTimeDisplay(
                timeDifferenceMinutes,
                timeDifferenceHours,
                timeDifferenceDays,
                timeDifferenceYears,
                t,
              )}
            />

            {paymentDescription && (
              <ThemeText
                CustomEllipsizeMode={'tail'}
                CustomNumberOfLines={2}
                styles={{
                  ...styles.descriptionText,
                  marginBottom: 10,
                }}
                content={paymentDescription}
              />
            )}

            <CustomButton
              useLoading={isLoading.sendBTN}
              loadingColor={backgroundColor}
              actionFunction={() => {
                acceptPayRequest(transaction, props.selectedContact);
              }}
              buttonStyles={{
                ...styles.acceptOrPayBTN,
                marginBottom: 10,
                backgroundColor: theme ? textColor : COLORS.primary,
              }}
              textStyles={{
                color: backgroundColor,
                includeFontPadding: false,
              }}
              textContent={t('constants.send')}
            />

            <CustomButton
              useLoading={isLoading.declineBTN}
              loadingColor={theme ? textColor : COLORS.primary}
              actionFunction={() => {
                updatePaymentStatus(transaction, true, false);
              }}
              buttonStyles={{
                ...styles.acceptOrPayBTN,
                borderWidth: 1,
                borderColor: theme ? textColor : COLORS.primary,
                backgroundColor: 'transparent',
              }}
              textStyles={{
                color: theme ? textColor : COLORS.primary,
                includeFontPadding: false,
              }}
              textContent={t('constants.decline')}
            />
          </View>
        </View>
      )}
    </TouchableOpacity>
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
  icons: {
    width: 30,
    height: 30,
    marginRight: 5,
  },
  requestTextContainer: {
    marginRight: 'auto',
    width: '100%',
    flexWrap: 'wrap',
    justifyContent: 'start',
  },
  descriptionText: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    fontWeight: 400,
  },
  dateText: {
    fontSize: SIZES.small,
    fontWeight: 300,
  },
  amountText: {
    fontWeight: 400,
  },

  acceptOrPayBTN: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 15,
    // paddingVertical: 8,
    alignItems: 'center',
  },
});
