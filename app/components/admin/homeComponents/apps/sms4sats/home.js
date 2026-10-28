import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../../constants';
import { getLocalStorageItem, copyToClipboard } from '../../../../../functions';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import { useKeysContext } from '../../../../../../context-store/keys';
import { encriptMessage } from '../../../../../functions/messaging/encodingAndDecodingMessages';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useToast } from '../../../../../../context-store/toastManager';
import {
  buildSmsMessageUniqueKey,
  dedupeSmsMessages,
  fetchReceiveOrder,
  fetchSms4Sats,
  formatSmsPhoneNumber,
  RECEIVE_TERMINAL_STATES,
  SMS4SATS_API,
} from './utils';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import EmptyState from '../../../../../functions/CustomElements/redesign/EmptyState';
import ListCard, {
  ListDivider,
} from '../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import IconButton from '../../../../../functions/CustomElements/redesign/IconButton';
import useContentWidth from '../../../../../functions/CustomElements/redesign/useContentWidth';

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
  const contentWidth = useContentWidth();
  const { decodedMessages, toggleGlobalAppDataInformation } =
    useGlobalAppData();
  const { contactsPrivateKey, publicKey } = useKeysContext();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const clickData = useRef({});
  const hasBootstrappedLocalHistory = useRef(false);

  const sendLabel = t('constants.send');
  const receiveLabel = t('constants.receive');

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

  const updateReceiveOrder = useCallback(
    async (selectedItem, update) => {
      const savedMessages = JSON.parse(JSON.stringify(localMessages));
      const updatedItem = { ...selectedItem, ...update };
      savedMessages.received = (savedMessages.received || []).map(item =>
        item.orderId === selectedItem.orderId ? updatedItem : item,
      );
      await saveMessagesToDB(savedMessages);
      return updatedItem;
    },
    [localMessages, saveMessagesToDB],
  );

  const openCode = useCallback(
    item =>
      navigate.navigate('CustomHalfModal', {
        wantedContent: 'viewSMSCode',
        code: item.code,
        title: item.title,
      }),
    [navigate],
  );

  // Orders bought before the v2 API have no access token; those can only
  // be read through the legacy status endpoint.
  const fetchOrderUpdate = useCallback(async item => {
    if (!item.accessToken) {
      const data = await fetchSms4Sats(
        `${SMS4SATS_API}/orderstatus?orderId=${encodeURIComponent(
          item.orderId,
        )}`,
      );
      const isRefunded = data.status === 'OK' && !!data.error;
      return {
        code: data.code,
        number: data.number || item.number,
        isPending: !data.code && !isRefunded,
        isRefunded,
      };
    }
    const order = await fetchReceiveOrder(item.orderId, item.accessToken);
    const code = order.messages?.find(message => message.code)?.code;
    const isDone = RECEIVE_TERMINAL_STATES.includes(order.status);
    return {
      code,
      number: order.phoneNumber || item.number,
      country: order.countryName || item.country,
      isPending: !code && !isDone,
      isRefunded: !code && isDone,
    };
  }, []);

  const handleReceiveAction = useCallback(
    async (selectedItem, setIsLoading) => {
      if (selectedItem.code) {
        openCode(selectedItem);
        return;
      }

      setIsLoading(true);
      try {
        const update = await fetchOrderUpdate(selectedItem);
        const updatedItem = await updateReceiveOrder(selectedItem, update);

        if (updatedItem.code) {
          openCode(updatedItem);
        } else if (updatedItem.isRefunded) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('apps.sms4sats.sentPayments.refundedOrder'),
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
    [fetchOrderUpdate, navigate, openCode, t, updateReceiveOrder],
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
    ({ item }) => (
      <SMSHistoryRow
        item={item}
        showToast={showToast}
        t={t}
        onOpenReceive={handleReceiveRateLimitedAction}
      />
    ),
    [handleReceiveRateLimitedAction, showToast, t],
  );

  if (isBootstrapping && !decodedMessages) {
    return <FullLoadingScreen />;
  }

  const actionButtons = (
    <View style={styles.buttonContainer}>
      <CustomButton
        textContent={sendLabel}
        actionFunction={() => navigate.navigate('SMSMessagingSendPage')}
        tone={'secondary'}
        size={'regular'}
      />
      <CustomButton
        textContent={receiveLabel}
        actionFunction={() =>
          navigate.navigate('SMSMessagingReceiveCountryPage')
        }
        tone={'secondary'}
        size={'regular'}
      />
    </View>
  );

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('apps.appList.SMS')} />
        {!combinedMessages.length ? (
          <View style={styles.empty}>
            <EmptyState
              icon={'MessageSquare'}
              title={t('apps.noPurchaseTitle')}
              sub={t('apps.sms4sats.sentPayments.noPurchasesTitle')}
            />
          </View>
        ) : (
          <>
            <ListCard style={styles.card}>
              <FlatList
                data={combinedMessages}
                renderItem={renderMessageItem}
                keyExtractor={(item, index) =>
                  buildSmsMessageUniqueKey(item, index)
                }
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={ListDivider}
              />
            </ListCard>
            <SupportFooter showToast={showToast} t={t} />
            <View style={styles.spacer} />
          </>
        )}
        {actionButtons}
      </View>
    </GlobalThemeView>
  );
}

function SupportFooter({ showToast, t }) {
  const { tokens } = GetThemeColors();
  return (
    <TouchableOpacity
      onPress={() => copyToClipboard('support@sms4sats.com', showToast)}
      style={styles.supportContainer}
    >
      <ThemeText
        styles={[styles.supportText, { color: tokens.muted }]}
        content={[
          t('apps.sms4sats.sentPayments.helpMessage'),
          ' ',
          <ThemeText
            key="email"
            styles={[styles.supportText, { color: tokens.link }]}
            content="support@sms4sats.com"
          />,
        ]}
      />
    </TouchableOpacity>
  );
}

function SMSHistoryRow({ item, onOpenReceive, showToast, t }) {
  const { tokens } = GetThemeColors();
  const [isLoading, setIsLoading] = useState(false);
  const isReceive = item.recordType === 'received';

  const title = isReceive
    ? item.title || t('constants.receive')
    : formatSmsPhoneNumber(item.phone);

  const status = !isReceive
    ? item.message
    : item.isRefunded
    ? t('apps.sms4sats.sentPayments.refunded')
    : item.code
    ? `${t('apps.sms4sats.home.codeLabel')}: ${item.code}`
    : t('apps.sms4sats.sentPayments.noCode');

  const number = isReceive && item.number && formatSmsPhoneNumber(item.number);
  const hasAction = isReceive && (item.code || item.isPending);

  return (
    <ListRow
      lead={
        <Disc
          icon={isReceive ? 'ArrowDown' : 'ArrowUp'}
          size={40}
          iconSize={18}
        />
      }
      title={title}
      titleLines={1}
      sub={number ? `${status}\n${number}` : status}
      subLines={3}
      trailing={
        isLoading ? (
          <ActivityIndicator color={tokens.ink} />
        ) : hasAction ? (
          <TouchableOpacity
            onPress={() => onOpenReceive(item, setIsLoading)}
            style={[styles.pill, { backgroundColor: tokens.accentPastel }]}
          >
            <ThemeText
              styles={[styles.pillText, { color: tokens.link }]}
              content={
                item.code
                  ? t('apps.sms4sats.home.viewCode')
                  : t('apps.sms4sats.sentPayments.retryClaim')
              }
            />
          </TouchableOpacity>
        ) : (
          <IconButton
            icon="Copy"
            label="constants.copy"
            tone="disc"
            size={36}
            iconSize={16}
            onPress={() =>
              copyToClipboard(
                isReceive && item.number ? item.number : item.orderId,
                showToast,
              )
            }
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginTop: 16,
    flexShrink: 1,
  },
  spacer: {
    flex: 1,
  },
  pill: {
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 13,
    includeFontPadding: false,
  },
  supportContainer: {
    paddingVertical: 20,
  },
  supportText: {
    fontSize: 13,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 10,
    marginTop: CONTENT_KEYBOARD_OFFSET,
  },
});
