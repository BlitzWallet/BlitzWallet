import React, { useCallback, useState, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { CENTER, COLORS, FONT, SIZES } from '../../../../../constants';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNavigation } from '@react-navigation/native';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../hooks/themeColors';
import { ThemeText } from '../../../../../functions/CustomElements';
import { getDataFromCollection, updateMessage } from '../../../../../../db';
import { sendPushNotification } from '../../../../../functions/messaging/publishMessage';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useKeysContext } from '../../../../../../context-store/keys';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useServerTimeOnly } from '../../../../../../context-store/serverTime';
import { useTranslation } from 'react-i18next';
import GiftCardTxItem from './giftCardTxItem';
import { getTimeDisplay } from '../../../../../functions/contacts';
import getReceiveAddressAndContactForContactsPayment from './getReceiveAddressAndKindForPayment';
import { useGlobalContacts } from '../../../../../../context-store/globalContacts';
import { getTransactionContent } from '../contactsPageComponents/transactionText';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

function ConfirmedOrSentTransaction({
  txParsed,
  paymentDescription,
  timeDifferenceMinutes,
  timeDifferenceHours,
  timeDifferenceDays,
  timeDifferenceYears,
  props,
  navigate,
}) {
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { textColor, backgroundOffset } = GetThemeColors();

  const didDeclinePayment = txParsed.isRedeemed != null && !txParsed.isRedeemed;

  const isOutgoingPayment =
    (txParsed.didSend && !txParsed.isRequest) ||
    (txParsed.isRequest && txParsed.isRedeemed && !txParsed.didSend);

  if (!!txParsed.giftCardInfo) {
    return (
      <GiftCardTxItem
        txParsed={txParsed}
        isOutgoingPayment={isOutgoingPayment}
        theme={theme}
        darkModeType={darkModeType}
        backgroundOffset={backgroundOffset}
        timeDifference={getTimeDisplay(
          timeDifferenceMinutes,
          timeDifferenceHours,
          timeDifferenceDays,
          timeDifferenceYears,
        )}
        isFromProfile={false}
        t={t}
        navigate={navigate}
        masterInfoObject={masterInfoObject}
      />
    );
  }

  return (
    <View style={[styles.transactionContainer, { alignItems: 'center' }]}>
      {didDeclinePayment ? (
        <ThemeIcon
          colorOverride={
            theme && darkModeType ? COLORS.darkModeText : COLORS.cancelRed
          }
          styles={styles.icons}
          iconName={'CircleX'}
        />
      ) : (
        <ThemeIcon
          styles={styles.icons}
          iconName={isOutgoingPayment ? 'ArrowUp' : 'ArrowDown'}
        />
      )}

      <View style={{ width: '100%', flex: 1 }}>
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
            includeFontPadding: false,
          }}
          content={getTransactionContent({
            paymentDescription,
            didDeclinePayment,
            txParsed,
            t,
          })}
        />
        <ThemeText
          styles={{
            ...styles.dateText,
            color: didDeclinePayment
              ? theme && darkModeType
                ? textColor
                : COLORS.cancelRed
              : textColor,
            includeFontPadding: false,
          }}
          content={getTimeDisplay(
            timeDifferenceMinutes,
            timeDifferenceHours,
            timeDifferenceDays,
            timeDifferenceYears,
          )}
        />
      </View>

      <FormattedSatText
        frontText={
          didDeclinePayment ||
          masterInfoObject.userBalanceDenomination === 'hidden'
            ? ''
            : isOutgoingPayment
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
  const { selectedContact, transaction, myProfile, currentTime, imageData } =
    props;
  const { t } = useTranslation();
  const { fiatStats } = useNodeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundColor } = GetThemeColors();
  const navigate = useNavigation();
  const getServerTime = useServerTimeOnly();
  const { globalContactsInformation } = useGlobalContacts();
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
    async (transaction, usingOnPage, didPay, txid) => {
      try {
        usingOnPage &&
          setIsLoading(prev => ({
            ...prev,
            [didPay ? 'sendBTN' : 'declineBTN']: true,
          }));
        let newMessage = {
          ...transaction.message,
          isRedeemed: didPay,
          txid,
          name:
            globalContactsInformation.myProfile.name ||
            globalContactsInformation.myProfile.uniqueName,
        };
        // Need to switch unqiue name since the original receiver is now the sender
        if (newMessage.senderProfileSnapshot) {
          newMessage.senderProfileSnapshot.uniqueName =
            globalContactsInformation.myProfile.uniqueName;
        }
        delete newMessage.didSend;
        delete newMessage.wasSeen;
        const [retrivedContact] = await Promise.all([
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
            privateKey: contactsPrivateKey,
            retrivedContact,
            masterInfoObject,
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
      masterInfoObject,
      globalContactsInformation,
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
          name:
            globalContactsInformation.myProfile.name ||
            globalContactsInformation.myProfile.uniqueName,
        },
      );

      const {
        receiveAddress,
        didWork,
        error,
        formattedPayingContactMessage,
        retrivedContact,
      } = await getReceiveAddressAndContactForContactsPayment({
        sendingAmountSat: sendingAmount,
        selectedContact,
        myProfileMessage,
        payingContactMessage,
      });

      if (!didWork) {
        navigate.navigate('ErrorScreen', {
          errorMessage: error,
          useTranslationString: true,
        });
        return;
      }

      setIsLoading(prev => ({
        ...prev,
        sendBTN: false,
      }));

      navigate.navigate('ConfirmPaymentScreen', {
        btcAdress: receiveAddress,
        comingFromAccept: true,
        enteredPaymentInfo: {
          amount: sendingAmount,
          description: myProfileMessage, // handles local tx description
        },
        contactInfo: {
          imageData,
          name: selectedContact.name || selectedContact.uniqueName,
          payingContactMessage: formattedPayingContactMessage, //handles remote tx description
          uniqueName: retrivedContact?.contacts?.myProfile?.uniqueName,
          uuid: retrivedContact?.uuid,
        },
        fromPage: 'contacts',
        publishMessageFunc: txid =>
          updatePaymentStatus(transaction, false, true, txid),
      });
      return;
    },
    [
      myProfile,
      navigate,
      updatePaymentStatus,
      globalContactsInformation,
      imageData,
      selectedContact,
    ],
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
      activeOpacity={1}
    >
      {isCompletedTransaction ? (
        <ConfirmedOrSentTransaction
          txParsed={txParsed}
          paymentDescription={paymentDescription}
          timeDifferenceMinutes={timeDifferenceMinutes}
          timeDifferenceHours={timeDifferenceHours}
          timeDifferenceDays={timeDifferenceDays}
          timeDifferenceYears={timeDifferenceYears}
          navigate={navigate}
          props={props}
        />
      ) : (
        <View style={styles.transactionContainer}>
          <ThemeIcon styles={styles.icons} iconName={'ArrowDown'} />

          <View style={{ width: '100%', flex: 1 }}>
            <ThemeText
              styles={{ includeFontPadding: false }}
              content={t(
                'contacts.internalComponents.contactsTransactions.requestTitle',
                {
                  amount: displayCorrectDenomination({
                    amount: txParsed.amountMsat / 1000,
                    masterInfoObject,
                    fiatStats,
                    useMillionDenomination: true,
                  }),
                },
              )}
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
              textContent={t(
                'contacts.internalComponents.contactsTransactions.send',
              )}
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
    alignItems: 'flex-start',
    paddingVertical: 12.5,
    ...CENTER,
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
