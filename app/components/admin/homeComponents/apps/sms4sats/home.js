import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import NoContentSceen from '../../../../../functions/CustomElements/noContentScreen';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
} from '../../../../../constants';
import { getLocalStorageItem, copyToClipboard } from '../../../../../functions';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import { useKeysContext } from '../../../../../../context-store/keys';
import { encriptMessage } from '../../../../../functions/messaging/encodingAndDecodingMessages';
import useAdaptiveButtonLayout from '../../../../../hooks/useAdaptiveButtonLayout';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useToast } from '../../../../../../context-store/toastManager';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import {
  buildSmsMessageUniqueKey,
  dedupeSmsMessages,
  formatSmsPhoneNumber,
} from './utils';
import { WINDOWWIDTH } from '../../../../../constants/theme';

const ORDER_STATUS_ENDPOINT = 'https://api2.sms4sats.com/orderstatus';
const RATE_LIMIT_WINDOW = 30000;
const RATE_LIMIT_COUNT = 5;

const EMPTY_SMS_MESSAGES = {
  sent: [],
  received: [],
};

export default function SMSMessagingHome() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();
  const { decodedMessages, toggleGlobalAppDataInformation } =
    useGlobalAppData();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const clickData = useRef({});
  const hasBootstrappedLocalHistory = useRef(false);

  const sendLabel = t('constants.send');
  const receiveLabel = t('constants.receive');

  const { shouldStack, containerProps, getLabelProps } =
    useAdaptiveButtonLayout([sendLabel, receiveLabel]);

  const saveMessagesToDB = useCallback(
    async nextMessages => {
      const encryptedMessages = encriptMessage(
        contactsPrivateKey,
        publicKey,
        JSON.stringify(nextMessages),
      );

      await toggleGlobalAppDataInformation(
        { messagesApp: encryptedMessages },
        true,
      );
    },
    [contactsPrivateKey, publicKey, toggleGlobalAppDataInformation],
  );

  useEffect(() => {
    if (!decodedMessages || hasBootstrappedLocalHistory.current) {
      if (decodedMessages) setIsBootstrapping(false);
      return;
    }

    hasBootstrappedLocalHistory.current = true;

    (async () => {
      try {
        const localStoredMessages =
          JSON.parse(await getLocalStorageItem('savedSMS4SatsIds')) || [];

        if (
          !Array.isArray(localStoredMessages) ||
          localStoredMessages.length === 0
        ) {
          return;
        }

        const mergedMessages = {
          ...decodedMessages,
          sent: dedupeSmsMessages([
            ...(decodedMessages?.sent || []),
            ...localStoredMessages,
          ]),
        };

        const currentSerialized = JSON.stringify(decodedMessages?.sent || []);
        const mergedSerialized = JSON.stringify(mergedMessages.sent);

        if (currentSerialized !== mergedSerialized) {
          await saveMessagesToDB(mergedMessages);
        }
      } catch (error) {
        console.log('Error bootstrapping sms history', error);
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, [decodedMessages, saveMessagesToDB]);

  const localMessages = decodedMessages || EMPTY_SMS_MESSAGES;

  const combinedMessages = useMemo(() => {
    const sentMessages = (localMessages.sent || []).map(
      (messageItem, index) => ({
        ...messageItem,
        recordType: 'sent',
        stableOrder: 100000 - index,
        sortValue:
          typeof messageItem?.createdAt === 'number'
            ? messageItem.createdAt
            : typeof messageItem?.timestamp === 'number'
            ? messageItem.timestamp
            : null,
      }),
    );

    const receivedMessages = (localMessages.received || []).map(
      (messageItem, index) => ({
        ...messageItem,
        recordType: 'received',
        stableOrder: 200000 - index,
        sortValue:
          typeof messageItem?.createdAt === 'number'
            ? messageItem.createdAt
            : typeof messageItem?.timestamp === 'number'
            ? messageItem.timestamp
            : null,
      }),
    );

    return [...sentMessages, ...receivedMessages].sort((messageA, messageB) => {
      if (messageA.sortValue == null && messageB.sortValue == null) {
        return messageB.stableOrder - messageA.stableOrder;
      }

      if (messageA.sortValue == null) return 1;
      if (messageB.sortValue == null) return -1;
      if (messageA.sortValue !== messageB.sortValue) {
        return messageB.sortValue - messageA.sortValue;
      }

      return messageB.stableOrder - messageA.stableOrder;
    });
  }, [localMessages.received, localMessages.sent]);

  const updateReceiveOrderStatus = useCallback(
    async (selectedItem, smsData, shouldDelete = false) => {
      const savedMessages = JSON.parse(JSON.stringify(localMessages));
      let updatedItem = null;

      if (shouldDelete) {
        savedMessages.received = (savedMessages.received || []).filter(
          item => item.orderId !== selectedItem.orderId,
        );
      } else {
        updatedItem = {
          ...selectedItem,
          code: smsData.code,
          number: smsData.number,
          country: smsData.country,
          id: smsData.id,
          timestamp: smsData.timestamp,
          isPending:
            !smsData.code && !(smsData.status === 'OK' && !!smsData.error),
          isRefunded: smsData.status === 'OK' && !!smsData.error,
        };

        savedMessages.received = (savedMessages.received || []).map(item =>
          item.orderId === selectedItem.orderId ? updatedItem : item,
        );
      }

      await saveMessagesToDB(savedMessages);
      return updatedItem;
    },
    [localMessages, saveMessagesToDB],
  );

  const fetchOrderStatus = useCallback(async orderId => {
    const response = await fetch(`${ORDER_STATUS_ENDPOINT}?orderId=${orderId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }, []);

  const handleReceiveAction = useCallback(
    async (selectedItem, setIsLoading) => {
      if (selectedItem.code) {
        navigate.navigate('ViewSMSReceiveCode', {
          country: selectedItem.country,
          code: selectedItem.code,
          phone: selectedItem.number,
        });
        return;
      }

      if (!selectedItem.isPending) {
        copyToClipboard(selectedItem.orderId, showToast);
        return;
      }

      setIsLoading(true);

      try {
        const smsData = await fetchOrderStatus(selectedItem.orderId);

        if (smsData.paid && smsData.code) {
          const updatedItem = await updateReceiveOrderStatus(
            selectedItem,
            smsData,
          );

          navigate.navigate('ViewSMSReceiveCode', {
            country: updatedItem.country,
            code: updatedItem.code,
            phone: updatedItem.number,
          });
        } else if (smsData.status === 'OK' && smsData.error) {
          await updateReceiveOrderStatus(selectedItem, smsData);
          navigate.navigate('ErrorScreen', {
            errorMessage: t('apps.sms4sats.sentPayments.refundedOrder'),
          });
        } else if (!selectedItem.number && smsData.number) {
          await updateReceiveOrderStatus(selectedItem, smsData);
          navigate.navigate('ErrorScreen', {
            errorMessage: t('apps.sms4sats.sentPayments.reclaimComplete'),
          });
        } else {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('apps.sms4sats.sentPayments.reclaimComplete'),
          });
        }
      } catch (error) {
        console.log('Error fetching sms receive order status', error);
        navigate.navigate('ErrorScreen', {
          errorMessage: t('apps.sms4sats.sentPayments.fetchOrderError'),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [fetchOrderStatus, navigate, showToast, t, updateReceiveOrderStatus],
  );

  const handleReceiveRateLimitedAction = useCallback(
    (selectedItem, setIsLoading) => {
      const now = Date.now();
      const orderId = selectedItem.orderId;

      if (!clickData.current[orderId]) {
        clickData.current[orderId] = {
          numberOfClicks: 1,
          lastClick: now,
        };
        handleReceiveAction(selectedItem, setIsLoading);
        return;
      }

      const orderClickData = clickData.current[orderId];

      if (now - orderClickData.lastClick < RATE_LIMIT_WINDOW) {
        if (orderClickData.numberOfClicks >= RATE_LIMIT_COUNT) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('apps.sms4sats.sentPayments.rateLimitError'),
          });
          return;
        }

        clickData.current[orderId] = {
          numberOfClicks: orderClickData.numberOfClicks + 1,
          lastClick: orderClickData.lastClick,
        };
      } else {
        clickData.current[orderId] = {
          numberOfClicks: 1,
          lastClick: now,
        };
      }

      handleReceiveAction(selectedItem, setIsLoading);
    },
    [handleReceiveAction, navigate, t],
  );

  const renderMessageItem = useCallback(
    ({ item }) => {
      return (
        <SMSHistoryCard
          item={item}
          showToast={showToast}
          navigate={navigate}
          t={t}
          onOpenReceive={handleReceiveRateLimitedAction}
          onDeleteReceive={updateReceiveOrderStatus}
          theme={theme}
        />
      );
    },
    [
      handleReceiveRateLimitedAction,
      navigate,
      showToast,
      t,
      updateReceiveOrderStatus,
      theme,
    ],
  );

  if (isBootstrapping && !decodedMessages) {
    return <FullLoadingScreen />;
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={t('apps.appList.SMS')} />
      <View style={styles.body}>
        {!combinedMessages.length ? (
          <NoContentSceen
            iconName="Receipt"
            titleText={t('apps.noPurchaseTitle')}
            subTitleText={t('apps.sms4sats.sentPayments.noPurchasesTitle')}
          />
        ) : (
          <FlatList
            data={combinedMessages}
            renderItem={renderMessageItem}
            keyExtractor={(item, index) =>
              buildSmsMessageUniqueKey(item, index)
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListFooterComponent={
              <TouchableOpacity
                onPress={() =>
                  copyToClipboard('support@sms4sats.com', showToast)
                }
                style={styles.supportContainer}
              >
                <ThemeText
                  styles={styles.supportText}
                  content={t('apps.sms4sats.sentPayments.helpMessage')}
                />
                <ThemeText
                  styles={styles.supportEmail}
                  content="support@sms4sats.com"
                />
              </TouchableOpacity>
            }
          />
        )}
      </View>

      <View
        {...containerProps}
        style={[
          styles.buttonContainer,
          shouldStack
            ? styles.buttonContainerStacked
            : styles.buttonContainerColumns,
        ]}
      >
        <CustomButton
          buttonStyles={[
            styles.actionButton,
            {
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            },
            shouldStack ? styles.buttonStacked : styles.buttonColumn,
          ]}
          textStyles={{
            color: theme ? COLORS.darkModeText : COLORS.lightModeText,
          }}
          enableElipsis={false}
          {...getLabelProps(0)}
          textContent={sendLabel}
          actionFunction={() => navigate.navigate('SMSMessagingSendPage')}
        />

        <CustomButton
          buttonStyles={[
            styles.actionButton,
            {
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            },
            shouldStack ? styles.buttonStacked : styles.buttonColumn,
          ]}
          textStyles={{
            color: theme ? COLORS.darkModeText : COLORS.lightModeText,
          }}
          enableElipsis={false}
          {...getLabelProps(1)}
          textContent={receiveLabel}
          actionFunction={() =>
            navigate.navigate('SMSMessagingReceiveCountryPage')
          }
        />
      </View>
    </GlobalThemeView>
  );
}

function SMSHistoryCard({
  item,
  navigate,
  onOpenReceive,
  onDeleteReceive,
  showToast,
  t,
  theme,
}) {
  const { backgroundColor } = GetThemeColors();
  const [isLoading, setIsLoading] = useState(false);
  const isReceive = item.recordType === 'received';
  const isRecivePending = isReceive && item.isPending;

  const subtitleText = useMemo(() => {
    if (!isReceive) return item.message;
    if (item.isRefunded) return t('apps.sms4sats.sentPayments.refunded');
    if (item.code) return `${t('apps.sms4sats.home.codeLabel')}: ${item.code}`;
    return t('apps.sms4sats.sentPayments.noCode');
  }, [isReceive, item.code, item.isRefunded, item.message, t]);

  const titleText = useMemo(() => {
    if (!isReceive) {
      return formatSmsPhoneNumber(item.phone);
    }

    return item.title || t('constants.receive');
  }, [isReceive, item.phone, item.title, t]);

  const extraText = useMemo(() => {
    if (!isReceive) return item.orderId;

    if (item.number) {
      try {
        return parsePhoneNumberWithError(
          item.number.startsWith('+') ? item.number : `+${item.number}`,
        ).formatInternational();
      } catch (error) {
        return item.number;
      }
    }

    return item.orderId;
  }, [isReceive, item.number, item.orderId]);

  const buttonText = useMemo(() => {
    if (!isReceive) return t('apps.sms4sats.sentPayments.orderId');
    if (item.code) {
      return t('apps.sms4sats.home.viewCode', { defaultValue: 'View code' });
    }
    if (item.isPending) {
      return t('apps.sms4sats.sentPayments.retryClaim');
    }
    return t('apps.sms4sats.sentPayments.orderId');
  }, [isReceive, item.code, item.isPending, t]);

  return (
    <View style={styles.card}>
      <View
        style={[
          styles.contentContainer,
          { marginBottom: isReceive && isRecivePending ? 8 : 0 },
        ]}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor,
            },
          ]}
        >
          <ThemeIcon
            size={20}
            iconName={!isReceive ? 'ArrowUp' : 'ArrowDown'}
          />
        </View>

        <View style={styles.badgeRow}>
          <ThemeText
            styles={styles.cardTitle}
            content={titleText}
            CustomNumberOfLines={1}
          />
          <ThemeText
            styles={styles.cardSubtitle}
            content={subtitleText}
            CustomNumberOfLines={2}
          />
          {isRecivePending && (
            <ThemeText
              styles={styles.cardDetails}
              content={extraText}
              CustomNumberOfLines={1}
            />
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.copyButton,
            {
              backgroundColor: theme ? backgroundColor : COLORS.darkModeText,
            },
          ]}
          onPress={() => {
            if (isRecivePending && item.number) {
              copyToClipboard(item.number, showToast);
              return;
            }

            copyToClipboard(item.orderId, showToast);
          }}
          disabled={isLoading}
        >
          <ThemeIcon size={16} iconName={'Copy'} />
        </TouchableOpacity>
      </View>

      {isReceive && isRecivePending && (
        <CustomButton
          actionFunction={() => {
            if (!isReceive) {
              copyToClipboard(item.orderId, showToast);
              return;
            }

            onOpenReceive(item, setIsLoading);
          }}
          buttonStyles={styles.cardButton}
          textContent={buttonText}
          useLoading={isLoading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  description: {
    fontSize: SIZES.smedium,
    opacity: 0.7,
    marginBottom: 12,
    lineHeight: 22,
  },
  listContent: {
    flexGrow: 1,
    width: WINDOWWIDTH,
    ...CENTER,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(127, 127, 127, 0.10)',
  },
  cardBody: { marginLeft: 'auto' },
  badgeRow: {
    gap: 2,
  },
  badgeText: {
    fontSize: SIZES.small,
    opacity: 0.7,
    textTransform: 'uppercase',
  },
  categoryContainer: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  categoryText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  cardTitle: {
    fontWeight: '500',
  },
  cardSubtitle: {
    fontSize: SIZES.smedium,
    opacity: 0.8,
  },
  cardDetails: {
    fontSize: SIZES.smedium,
    opacity: 0.8,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  cardButton: {
    width: '100%',
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
  deleteButton: {
    padding: 8,
  },
  supportContainer: {
    paddingVertical: 20,
  },
  supportText: {
    textAlign: 'center',
    marginBottom: 4,
  },
  supportEmail: {
    textAlign: 'center',
    fontWeight: '600',
  },
  buttonContainer: {
    width: WINDOWWIDTH,
    gap: 10,
    alignItems: 'center',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
  buttonContainerColumns: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonContainerStacked: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  actionButton: {
    minHeight: 50,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonColumn: {
    flex: 1,
  },
  buttonStacked: {
    width: '100%',
  },

  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyButton: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 'auto',
  },
});
