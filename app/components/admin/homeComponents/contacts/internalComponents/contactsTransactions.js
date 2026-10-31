import React, { useCallback, useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNavigation } from '@react-navigation/native';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../hooks/themeColors';
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
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';
import { getTransactionContent } from '../contactsPageComponents/transactionText';
import { PARENT_ACCOUNT_TRANSFER_MARKER } from '../../../../../functions/messaging/parentAccountTransferMessage';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { formatBalanceAmount } from '../../../../../functions';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import AdaptiveButtonRow from '../../../../../functions/CustomElements/adaptiveButtonRow';

// An unpaid request from the contact that is waiting on me. Same condition the
// old render used for "not a completed transaction".
export const isAwaitingMyPayment = message =>
  !!message &&
  !message.didSend &&
  !!message.isRequest &&
  message.isRedeemed == null;

const ConfirmedOrSentTransaction = React.memo(
  ({
    txParsed,
    paymentDescription,
    timestamp,
    timeDisplay,
    navigate,
    masterInfoObject,
    isPendingRequest,
    contactName,
    onPress,
  }) => {
    const { t } = useTranslation();
    const { tokens, backgroundOffset } = GetThemeColors();
    const { theme, darkModeType } = useGlobalThemeContext();

    const didDeclinePayment =
      txParsed.isRedeemed != null && !txParsed.isRedeemed;
    const isOutgoingPayment = useMemo(() => {
      if (txParsed?.[PARENT_ACCOUNT_TRANSFER_MARKER]) {
        if (typeof txParsed.isDeposit === 'boolean') {
          // didSend is stamped per viewer when the message is cached (true on the
          // parent's device, false on the child's), so the direction is opposite
          // of the deposit flag for the recipient.
          return txParsed.didSend ? !!txParsed.isDeposit : !txParsed.isDeposit;
        }
      }
      return (
        (txParsed.didSend && !txParsed.isRequest) ||
        (txParsed.isRequest && txParsed.isRedeemed && !txParsed.didSend)
      );
    }, [
      txParsed.didSend,
      txParsed.isRequest,
      txParsed.isRedeemed,
      txParsed.isDeposit,
    ]);

    // The description moves to the sub line; plain payments read "X sent you" /
    // "You paid X", requests and transfers keep their existing labels.
    const title = useMemo(() => {
      const isTransfer =
        txParsed?.[PARENT_ACCOUNT_TRANSFER_MARKER] &&
        typeof txParsed.isDeposit === 'boolean';
      if (!isTransfer && !txParsed.isRequest) {
        return t(
          txParsed.didSend
            ? 'contacts.internalComponents.contactsTransactions.youPaid'
            : 'contacts.internalComponents.contactsTransactions.theySentYou',
          { name: contactName },
        );
      }
      return getTransactionContent({
        paymentDescription: '',
        didDeclinePayment,
        txParsed,
        t,
      });
    }, [didDeclinePayment, txParsed, t, contactName]);

    const timeText = useMemo(
      () =>
        new Date(timestamp).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        }),
      [timestamp],
    );

    const balanceValue = useMemo(
      () =>
        txParsed?.paymentDenomination === 'USD'
          ? parseFloat(txParsed.amountDollars || 0)
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
      <ListRow
        onPress={onPress}
        minHeight={64}
        titleStyle={styles.title}
        titleLines={2}
        subLines={2}
        lead={
          <Disc
            size={40}
            tone={didDeclinePayment ? 'danger' : 'default'}
            icon={
              didDeclinePayment
                ? 'CircleX'
                : isPendingRequest
                ? 'Clock'
                : isOutgoingPayment
                ? 'ArrowUp'
                : 'ArrowDown'
            }
          />
        }
        title={title}
        sub={[paymentDescription, timeText].filter(Boolean).join(' · ')}
        trailing={
          <FormattedSatText
            frontText={
              didDeclinePayment ||
              masterInfoObject.userBalanceDenomination === 'hidden'
                ? ''
                : isOutgoingPayment
                ? '-'
                : '+'
            }
            styles={{
              ...styles.amount,
              ...(didDeclinePayment && { color: tokens.danger }),
            }}
            balance={balanceValue}
            useMillionDenomination
            useBalance={txParsed?.paymentDenomination === 'USD'}
            useCustomLabel={txParsed?.paymentDenomination === 'USD'}
            customLabel={
              txParsed?.paymentDenomination === 'USD' ? 'USDB' : null
            }
          />
        }
      />
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
  const { tokens } = GetThemeColors();
  const navigate = useNavigation();
  const getServerTime = useServerTimeOnly();
  const { globalContactsInformation } = useGlobalContactsInfo();

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

  const isPendingRequest = txParsed?.isRequest && txParsed.isRedeemed === null;

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
          inputCurrency: transaction.message.paymentDenomination || 'BTC',
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
    if (txParsed?.[PARENT_ACCOUNT_TRANSFER_MARKER]) return;
    if (paymentDescription) {
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'expandedContactMessage',
        sliderHight: 0.4,
        message: paymentDescription,
        selectedContact,
        txParsed,
        amount: requestAmount,
        timestamp: transaction.timestamp,
      });
    }
  }, [
    paymentDescription,
    navigate,
    txParsed,
    selectedContact,
    requestAmount,
    transaction.timestamp,
  ]);

  if (!txParsed) return null;

  const contactName = selectedContact.name || selectedContact.uniqueName;

  if (isCompletedTransaction) {
    return (
      <ConfirmedOrSentTransaction
        txParsed={txParsed}
        paymentDescription={paymentDescription}
        timestamp={transaction.timestamp}
        timeDisplay={timeDisplay}
        navigate={navigate}
        masterInfoObject={masterInfoObject}
        isPendingRequest={isPendingRequest}
        contactName={contactName}
        onPress={
          paymentDescription && !txParsed?.[PARENT_ACCOUNT_TRANSFER_MARKER]
            ? handlePress
            : undefined
        }
      />
    );
  }

  const payText = t('constants.pay');
  const declineText = t('constants.decline');

  return (
    <View style={styles.waitingItem}>
      <ListRow
        onPress={paymentDescription ? handlePress : undefined}
        minHeight={40}
        paddingVertical={0}
        titleStyle={styles.title}
        titleLines={2}
        subLines={2}
        lead={<Disc icon="ArrowDown" size={40} />}
        title={t(
          'contacts.internalComponents.contactsTransactions.requestedAmount',
          { name: contactName, amount: requestAmount },
        )}
        sub={[paymentDescription, timeDisplay].filter(Boolean).join(' · ')}
      />
      <AdaptiveButtonRow
        pill
        labels={[declineText, payText]}
        containerStyle={styles.waitingButtons}
      >
        {({ buttonStyle }) => (
          <>
            <CustomButton
              useLoading={isLoading.declineBTN}
              loadingColor={tokens.ink}
              actionFunction={() =>
                updatePaymentStatus(transaction, true, false)
              }
              buttonStyles={[buttonStyle, { backgroundColor: tokens.ground }]}
              enableElipsis={false}
              textContent={declineText}
              size={'compact'}
              tone={'secondary'}
            />
            <CustomButton
              useLoading={isLoading.sendBTN}
              loadingColor={tokens.onAccent}
              actionFunction={() =>
                acceptPayRequest(transaction, selectedContact)
              }
              buttonStyles={buttonStyle}
              enableElipsis={false}
              textContent={payText}
              size={'compact'}
            />
          </>
        )}
      </AdaptiveButtonRow>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, lineHeight: 21 },
  amount: { fontSize: 15, includeFontPadding: false },
  waitingItem: { paddingVertical: 16 },
  waitingButtons: { width: '100%', marginTop: 14 },
});
