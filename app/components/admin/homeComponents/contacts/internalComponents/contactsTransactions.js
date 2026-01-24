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
import { formatBalanceAmount } from '../../../../../functions';

const ConfirmedOrSentTransaction = React.memo(
  ({
    txParsed,
    paymentDescription,
    timeDifferenceMinutes,
    timeDifferenceHours,
    timeDifferenceDays,
    timeDifferenceYears,
    navigate,
    masterInfoObject,
  }) => {
    const { t } = useTranslation();
    const { theme, darkModeType } = useGlobalThemeContext();
    const { textColor, backgroundOffset } = GetThemeColors();

    const didDeclinePayment =
      txParsed.isRedeemed != null && !txParsed.isRedeemed;
    const isOutgoingPayment = useMemo(
      () =>
        (txParsed.didSend && !txParsed.isRequest) ||
        (txParsed.isRequest && txParsed.isRedeemed && !txParsed.didSend),
      [txParsed.didSend, txParsed.isRequest, txParsed.isRedeemed],
    );

    const timeDisplay = useMemo(
      () =>
        getTimeDisplay(
          timeDifferenceMinutes,
          timeDifferenceHours,
          timeDifferenceDays,
          timeDifferenceYears,
        ),
      [
        timeDifferenceMinutes,
        timeDifferenceHours,
        timeDifferenceDays,
        timeDifferenceYears,
      ],
    );

    const transactionContent = useMemo(
      () =>
        getTransactionContent({
          paymentDescription,
          didDeclinePayment,
          txParsed,
          t,
        }),
      [paymentDescription, didDeclinePayment, txParsed, t],
    );

    const textColorValue = useMemo(
      () =>
        didDeclinePayment
          ? theme && darkModeType
            ? textColor
            : COLORS.cancelRed
          : textColor,
      [didDeclinePayment, theme, darkModeType, textColor],
    );

    const balanceValue = useMemo(
      () =>
        txParsed?.paymentDenomination === 'USD'
          ? formatBalanceAmount(txParsed.amountDollars, false, masterInfoObject)
          : txParsed.amountMsat / 1000,
      [
        txParsed?.paymentDenomination,
        txParsed?.amountDollars,
        txParsed?.amountMsat,
        masterInfoObject,
      ],
    );

    if (txParsed.giftCardInfo) {
      return (
        <GiftCardTxItem
          txParsed={txParsed}
          isOutgoingPayment={isOutgoingPayment}
          theme={theme}
          darkModeType={darkModeType}
          backgroundOffset={backgroundOffset}
          timeDifference={timeDisplay}
          isFromProfile={false}
          t={t}
          navigate={navigate}
          masterInfoObject={masterInfoObject}
        />
      );
    }

    return (
      <View style={[styles.transactionContainer, styles.centerAlign]}>
        <ThemeIcon
          colorOverride={
            didDeclinePayment
              ? theme && darkModeType
                ? COLORS.darkModeText
                : COLORS.cancelRed
              : undefined
          }
          styles={styles.icons}
          iconName={
            didDeclinePayment
              ? 'CircleX'
              : isOutgoingPayment
              ? 'ArrowUp'
              : 'ArrowDown'
          }
        />

        <View style={styles.contentContainer}>
          <ThemeText
            CustomEllipsizeMode="tail"
            CustomNumberOfLines={1}
            styles={{
              ...styles.descriptionText,
              color: textColorValue,
              marginRight: 15,
              includeFontPadding: false,
            }}
            content={transactionContent}
          />
          <ThemeText
            styles={{
              ...styles.dateText,
              color: textColorValue,
              includeFontPadding: false,
            }}
            content={timeDisplay}
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
          containerStyles={styles.amountContainer}
          styles={{
            ...styles.amountText,
            color: textColorValue,
            includeFontPadding: false,
          }}
          balance={balanceValue}
          useMillionDenomination
          useBalance={txParsed?.paymentDenomination === 'USD'}
          useCustomLabel={txParsed?.paymentDenomination === 'USD'}
          customLabel={txParsed?.paymentDenomination === 'USD' ? 'USDB' : null}
        />
      </View>
    );
  },
);

ConfirmedOrSentTransaction.displayName = 'ConfirmedOrSentTransaction';

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

  const timeCalculations = useMemo(() => {
    const timeDifferenceMs = Math.abs(currentTime - transaction.timestamp);

    return {
      timeDifferenceMinutes: timeDifferenceMs / (1000 * 60),
      timeDifferenceHours: timeDifferenceMs / (1000 * 60 * 60),
      timeDifferenceDays: timeDifferenceMs / (1000 * 60 * 60 * 24),
      timeDifferenceYears: timeDifferenceMs / (1000 * 60 * 60 * 24 * 365),
    };
  }, [currentTime, transaction.timestamp]);

  const txParsed = transaction.message;
  const paymentDescription = txParsed?.description || '';

  // Memoized computed values
  const isCompletedTransaction = useMemo(
    () =>
      txParsed?.didSend ||
      !txParsed?.isRequest ||
      (txParsed?.isRequest && txParsed.isRedeemed != null),
    [txParsed?.didSend, txParsed?.isRequest, txParsed?.isRedeemed],
  );

  const requestAmount = useMemo(() => {
    if (txParsed?.paymentDenomination === 'USD') {
      return displayCorrectDenomination({
        amount: formatBalanceAmount(
          txParsed?.amountDollars,
          false,
          masterInfoObject,
        ),
        masterInfoObject: {
          ...masterInfoObject,
          userBalanceDenomination: 'fiat',
        },
        fiatStats,
        forceCurrency: 'USD',
        convertAmount: false,
      });
    } else {
      return displayCorrectDenomination({
        amount: txParsed?.amountMsat / 1000,
        masterInfoObject,
        fiatStats,
        useMillionDenomination: true,
      });
    }
  }, [txParsed?.amountMsat, masterInfoObject, fiatStats]);

  const timeDisplay = useMemo(
    () =>
      getTimeDisplay(
        timeCalculations.timeDifferenceMinutes,
        timeCalculations.timeDifferenceHours,
        timeCalculations.timeDifferenceDays,
        timeCalculations.timeDifferenceYears,
      ),
    [timeCalculations],
  );

  const updatePaymentStatus = useCallback(
    async (transaction, usingOnPage, didPay, txid) => {
      try {
        if (usingOnPage) {
          setIsLoading(prev => ({
            ...prev,
            [didPay ? 'sendBTN' : 'declineBTN']: true,
          }));
        }

        const newMessage = {
          ...transaction.message,
          isRedeemed: didPay,
          txid,
          name:
            globalContactsInformation.myProfile.name ||
            globalContactsInformation.myProfile.uniqueName,
        };

        if (newMessage.senderProfileSnapshot) {
          newMessage.senderProfileSnapshot.uniqueName =
            globalContactsInformation.myProfile.uniqueName;
        }
        delete newMessage.didSend;
        delete newMessage.wasSeen;

        const retrivedContact = await getDataFromCollection(
          'blitzWalletUsers',
          selectedContact.uuid,
        );

        if (!retrivedContact) {
          throw new Error(t('errormessages.userDataFetchError'));
        }

        const currentTime = getServerTime();

        const useNewNotifications = !!retrivedContact.isUsingNewNotifications;

        const notificationData = {
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
        };

        const updateMessageParams = retrivedContact.isUsingEncriptedMessaging
          ? {
              newMessage,
              fromPubKey: publicKey,
              toPubKey: selectedContact.uuid,
              retrivedContact,
              privateKey: contactsPrivateKey,
              currentTime,
            }
          : {
              newMessage,
              fromPubKey: transaction.fromPubKey,
              toPubKey: transaction.toPubKey,
              retrivedContact,
              privateKey: contactsPrivateKey,
              currentTime,
            };

        const [didPublishNotification, didUpdateMessage] = await Promise.all([
          sendPushNotification({
            selectedContactUsername: selectedContact.uniqueName,
            myProfile,
            data: notificationData,
            privateKey: contactsPrivateKey,
            retrivedContact,
            masterInfoObject,
          }),
          updateMessage(updateMessageParams),
        ]);

        if (!didUpdateMessage && usingOnPage) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('errormessages.updateContactMessageError'),
          });
        }
      } catch (err) {
        console.error('Update payment status error:', err);
        if (usingOnPage) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('errormessages.declinePaymentError'),
          });
        }
      } finally {
        if (usingOnPage) {
          setIsLoading(prev => ({
            ...prev,
            [didPay ? 'sendBTN' : 'declineBTN']: false,
          }));
        }
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
      t,
    ],
  );

  const acceptPayRequest = useCallback(
    async (transaction, selectedContact) => {
      setIsLoading(prev => ({ ...prev, sendBTN: true }));

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
        setIsLoading(prev => ({ ...prev, sendBTN: false }));
        navigate.navigate('ErrorScreen', {
          errorMessage: error,
          useTranslationString: true,
        });
        return;
      }

      setIsLoading(prev => ({ ...prev, sendBTN: false }));

      navigate.navigate('ConfirmPaymentScreen', {
        btcAdress: receiveAddress,
        comingFromAccept: true,
        enteredPaymentInfo: {
          fromContacts: true,
          payingContactsRequest: true,
          amount: sendingAmount,
          description: myProfileMessage,
          endReceiveType: transaction.message.paymentDenomination || 'BTC',
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
    },
    [navigate, updatePaymentStatus, globalContactsInformation, imageData, t],
  );

  const handlePress = useCallback(() => {
    if (paymentDescription) {
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'expandedContactMessage',
        sliderHight: 0.3,
        message: paymentDescription,
      });
    }
  }, [paymentDescription, navigate]);

  if (!txParsed) return null;

  const buttonStyle = useMemo(
    () => ({
      ...styles.acceptOrPayBTN,
      backgroundColor: theme ? textColor : COLORS.primary,
    }),
    [theme, textColor],
  );

  const declineButtonStyle = useMemo(
    () => ({
      ...styles.acceptOrPayBTN,
      borderWidth: 1,
      borderColor: theme ? textColor : COLORS.primary,
      backgroundColor: 'transparent',
    }),
    [theme, textColor],
  );

  return (
    <TouchableOpacity onPress={handlePress} key={props.id} activeOpacity={1}>
      {isCompletedTransaction ? (
        <ConfirmedOrSentTransaction
          txParsed={txParsed}
          paymentDescription={paymentDescription}
          {...timeCalculations}
          navigate={navigate}
          masterInfoObject={masterInfoObject}
        />
      ) : (
        <View style={styles.transactionContainer}>
          <ThemeIcon styles={styles.icons} iconName="ArrowDown" />

          <View style={styles.contentContainer}>
            <ThemeText
              styles={{ includeFontPadding: false }}
              content={t(
                'contacts.internalComponents.contactsTransactions.requestTitle',
                {
                  amount: requestAmount,
                },
              )}
            />
            <ThemeText
              styles={{
                ...styles.dateText,
                marginBottom: paymentDescription ? 0 : 15,
              }}
              content={timeDisplay}
            />

            {paymentDescription && (
              <ThemeText
                CustomEllipsizeMode="tail"
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
              actionFunction={() =>
                acceptPayRequest(transaction, selectedContact)
              }
              buttonStyles={{ ...buttonStyle, marginBottom: 10 }}
              textStyles={{ color: backgroundColor, includeFontPadding: false }}
              textContent={t(
                'contacts.internalComponents.contactsTransactions.send',
              )}
            />

            <CustomButton
              useLoading={isLoading.declineBTN}
              loadingColor={theme ? textColor : COLORS.primary}
              actionFunction={() =>
                updatePaymentStatus(transaction, true, false)
              }
              buttonStyles={declineButtonStyle}
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
  centerAlign: {
    alignItems: 'center',
  },
  contentContainer: {
    width: '100%',
    flex: 1,
  },
  icons: {
    width: 30,
    height: 30,
    marginRight: 5,
  },
  descriptionText: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    fontWeight: '400',
  },
  dateText: {
    fontSize: SIZES.small,
    fontWeight: '300',
  },
  amountText: {
    fontWeight: '400',
  },
  amountContainer: {
    marginBottom: 'auto',
  },
  acceptOrPayBTN: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 15,
    alignItems: 'center',
  },
});
