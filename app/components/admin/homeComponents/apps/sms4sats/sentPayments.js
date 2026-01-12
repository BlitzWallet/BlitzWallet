import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { SIZES } from '../../../../../constants';
import { copyToClipboard } from '../../../../../functions';
import { useNavigation } from '@react-navigation/native';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import { useToast } from '../../../../../../context-store/toastManager';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useKeysContext } from '../../../../../../context-store/keys';
import { encriptMessage } from '../../../../../functions/messaging/encodingAndDecodingMessages';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

const API_ENDPOINTS = {
  ORDER_STATUS: 'https://api2.sms4sats.com/orderstatus',
};

export default function HistoricalSMSMessagingPage({ route }) {
  const { showToast } = useToast();
  const navigate = useNavigation();
  const [messageElements, setMessageElements] = useState([]);
  const { decodedMessages, toggleGlobalAppDataInformation } =
    useGlobalAppData();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const { t } = useTranslation();
  const clickData = useRef({});

  const selectedPage = route?.params?.selectedPage?.toLowerCase() || 'send';
  const isReceiveMode = selectedPage !== 'send';

  const formatPhoneNumber = useCallback(number => {
    if (!number) return '';
    try {
      let formmattedNumber = number.includes('+') ? number : '+' + number;
      return parsePhoneNumberWithError(formmattedNumber).formatInternational();
    } catch (error) {
      console.warn('Phone formatting error:', error);
      return number;
    }
  }, []);

  const messagesData = useMemo(() => {
    if (!decodedMessages) return [];
    return decodedMessages[isReceiveMode ? 'received' : 'sent'] || [];
  }, [decodedMessages, isReceiveMode]);

  const fetchOrderStatus = useCallback(
    async orderId => {
      try {
        const response = await fetch(
          `${API_ENDPOINTS.ORDER_STATUS}?orderId=${orderId}`,
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const responseData = await response.json();
        return responseData;
      } catch (error) {
        console.error('Error fetching order status:', error);
        navigate.navigate('ErrorScreen', {
          errorMessage: t('apps.sms4sats.sentPayments.fetchOrderError'),
        });
        throw error;
      }
    },
    [showToast],
  );

  const updateOrderStatus = useCallback(
    async (element, smsData, shouldDelete = false) => {
      console.log(smsData);
      const savedMessages = JSON.parse(JSON.stringify(decodedMessages));
      let updatedItem = {};

      if (shouldDelete) {
        const newReceived = savedMessages[
          isReceiveMode ? 'received' : 'sent'
        ]?.filter(item => item.orderId !== element.orderId);

        savedMessages[isReceiveMode ? 'received' : 'sent'] = newReceived;
      } else {
        updatedItem = {
          ...element,
          code: smsData.code,
          number: smsData.number,
          country: smsData.country,
          id: smsData.id,
          timestamp: smsData.timestamp,
          isPending:
            !smsData.code && !(smsData.status === 'OK' && !!smsData.error),
          isRefunded: smsData.status === 'OK' && !!smsData.error,
        };

        const newReceived = savedMessages.received.map(item =>
          item.orderId === element.orderId ? updatedItem : item,
        );

        savedMessages.received = newReceived;
      }

      try {
        const encryptedMessage = encriptMessage(
          contactsPrivateKey,
          publicKey,
          JSON.stringify(savedMessages),
        );
        await toggleGlobalAppDataInformation(
          { messagesApp: encryptedMessage },
          true,
        );

        if (!shouldDelete) return updatedItem;
      } catch (error) {
        console.error('Error updating order status:', error);
        navigate.navigate('ErrorScreen', {
          errorMessage: t('apps.sms4sats.sentPayments.failedUpdate'),
        });
        throw error;
      }
    },
    [
      decodedMessages,
      contactsPrivateKey,
      publicKey,
      toggleGlobalAppDataInformation,
      showToast,
      isReceiveMode,
    ],
  );

  const handleOrderPress = useCallback(
    async (element, setIsLoading) => {
      if (!isReceiveMode) {
        copyToClipboard(element.orderId, showToast);
        return;
      }

      if (element.code) {
        navigate.navigate('ViewSMSReceiveCode', {
          country: element.country,
          code: element.code,
          phone: element.number,
        });
        return;
      }

      if (!element.isPending) return;

      setIsLoading(true);
      try {
        const smsData = await fetchOrderStatus(element.orderId);
        console.log(smsData);

        if (smsData.paid && smsData.code) {
          const updatedItem = await updateOrderStatus(element, smsData);
          navigate.navigate('ViewSMSReceiveCode', {
            country: updatedItem.country,
            code: updatedItem.code,
            phone: updatedItem.number,
          });
        } else if (smsData.status === 'OK' && smsData.error) {
          await updateOrderStatus(element, smsData);
          navigate.navigate('ErrorScreen', {
            errorMessage: t('apps.sms4sats.sentPayments.refundedOrder'),
          });
        } else if (!element.number && smsData.number) {
          await updateOrderStatus(element, smsData);
        } else {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('apps.sms4sats.sentPayments.reclaimComplete'),
          });
        }
      } catch (error) {
        // Error already handled in fetchOrderStatus
      } finally {
        setIsLoading(false);
      }
    },
    [isReceiveMode, showToast, navigate, fetchOrderStatus, updateOrderStatus],
  );

  const getDisplayContent = useCallback(
    (element, field) => {
      switch (field) {
        case 'title':
          if (!isReceiveMode) return formatPhoneNumber(element.phone);
          if (element.isRefunded)
            return t('apps.sms4sats.sentPayments.refunded');
          return element.title;

        case 'subtitle':
          return isReceiveMode
            ? element.code || t('apps.sms4sats.sentPayments.noCode')
            : element.message;

        case 'details':
          return element.orderId;
        default:
          return '';
      }
    },
    [isReceiveMode, formatPhoneNumber, t],
  );

  // Get button text
  const getButtonText = useCallback(
    element => {
      if (isReceiveMode && !element.code) {
        return t('apps.sms4sats.sentPayments.retryClaim');
      }
      return t('apps.sms4sats.sentPayments.orderId');
    },
    [isReceiveMode, t],
  );

  const MessageItem = ({ element }) => {
    const [isLoading, setIsLoading] = useState(false);
    return (
      <View style={styles.orderIdContainer}>
        <TouchableOpacity
          style={styles.textContainer}
          onPress={() => {
            if (isReceiveMode && element.isPending && element.number) {
              copyToClipboard(element.number, showToast);
              return;
            }
            copyToClipboard(element.orderId, showToast);
          }}
          disabled={isLoading}
        >
          <ThemeText
            CustomNumberOfLines={1}
            content={getDisplayContent(element, 'title')}
          />
          {isReceiveMode && element.number && (
            <ThemeText
              CustomNumberOfLines={1}
              content={formatPhoneNumber(element.number)}
            />
          )}
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.textStyles}
            content={getDisplayContent(element, 'subtitle')}
          />
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.textStyles}
            content={getDisplayContent(element, 'details')}
          />
        </TouchableOpacity>

        {isReceiveMode && element.isPending && (
          <CustomButton
            actionFunction={() => {
              const now = Date.now();
              const orderId = element.orderId;

              if (!clickData.current[orderId]) {
                clickData.current[orderId] = {
                  numberOfClicks: 1,
                  lastClick: now,
                };
                handleOrderPress(element, setIsLoading);
                return;
              }

              const orderClickData = clickData.current[orderId];

              if (now - orderClickData.lastClick < 30000) {
                if (orderClickData.numberOfClicks >= 5) {
                  navigate.navigate('ErrorScreen', {
                    errorMessage: t(
                      'apps.sms4sats.sentPayments.rateLimitError',
                    ),
                  });
                  return;
                }

                clickData.current[orderId].numberOfClicks += 1;
              } else {
                clickData.current[orderId] = {
                  numberOfClicks: 1,
                  lastClick: now,
                };
              }

              handleOrderPress(element, setIsLoading);
            }}
            buttonStyles={styles.buttonStyle}
            textContent={getButtonText(element)}
            useLoading={isLoading}
          />
        )}
        {(element.isRefunded || !element.isPending) && (
          <TouchableOpacity
            onPress={() => updateOrderStatus(element, undefined, true)}
          >
            <ThemeIcon iconName={'Trash2'} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderMessageItem = useCallback(
    element => <MessageItem key={element.orderId} element={element} />,
    [handleOrderPress, getDisplayContent, getButtonText],
  );

  useEffect(() => {
    const elements = messagesData.map(renderMessageItem);
    setMessageElements(elements);
  }, [messagesData, renderMessageItem]);

  const handleSupportContact = useCallback(() => {
    copyToClipboard('support@sms4sats.com', showToast);
  }, [showToast]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t(
          `apps.sms4sats.sentPayments.title${selectedPage.toLowerCase()}`,
        )}
      />

      <View style={styles.homepage}>
        {messageElements.length === 0 ? (
          <View style={styles.centered}>
            <ThemeText
              content={t(
                `apps.sms4sats.sentPayments.noPayments${selectedPage.toLowerCase()}`,
              )}
              styles={styles.emptyStateText}
            />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContainer}
          >
            {messageElements}
          </ScrollView>
        )}

        {!!messageElements.length && (
          <TouchableOpacity
            onPress={handleSupportContact}
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
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  homepage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIdContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
  },
  textContainer: {
    flex: 1,
    marginRight: 20,
  },
  textStyles: {
    fontSize: SIZES.small,
    marginTop: 4,
  },
  buttonStyle: {
    minWidth: 50,
    flexShrink: 0,
  },
  scrollContainer: {
    paddingVertical: 20,
    width: '90%',
  },
  supportContainer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  supportText: {
    textAlign: 'center',
    marginBottom: 4,
  },
  supportEmail: {
    textAlign: 'center',
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    fontSize: SIZES.medium,
  },
  deleteItemBTN: {},
});
