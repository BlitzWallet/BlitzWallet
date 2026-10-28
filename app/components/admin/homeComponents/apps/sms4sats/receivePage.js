import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import CountryFlag from 'react-native-country-flag';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { CENTER, FONT } from '../../../../../constants';
import { KEYBOARDTIMEOUT } from '../../../../../constants/styles';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import GetThemeColors from '../../../../../hooks/themeColors';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { useGlobalAppData } from '../../../../../../context-store/appData';
import sendStorePayment from '../../../../../functions/apps/payments';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { encriptMessage } from '../../../../../functions/messaging/encodingAndDecodingMessages';
import { useKeysContext } from '../../../../../../context-store/keys';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useWebView } from '../../../../../../context-store/webViewContext';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import CustomButton from '../../../../../functions/CustomElements/button';
import { copyToClipboard } from '../../../../../functions';
import { useToast } from '../../../../../../context-store/toastManager';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import { KeyboardController } from 'react-native-keyboard-controller';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import PageHeader from '../../../../../functions/CustomElements/redesign/PageHeader';
import SearchField from '../../../../../functions/CustomElements/redesign/SearchField';
import DiscText from '../../../../../functions/CustomElements/redesign/DiscText';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import EmptyState from '../../../../../functions/CustomElements/redesign/EmptyState';
import useContentWidth from '../../../../../functions/CustomElements/redesign/useContentWidth';
import {
  fetchReceiveOrder,
  fetchSms4Sats,
  formatSmsPhoneNumber,
  RECEIVE_TERMINAL_STATES,
  SMS4SATS_API,
  toSms4SatsCountryId,
} from './utils';

// The catalog has ~800 services; the common ones go first.
const POPULAR_SERVICES = [
  'tg', // Telegram
  'wa', // WhatsApp
  'go', // Google
  'ds', // Discord
  'bw', // Signal
  'ub', // Uber
  'am', // Amazon
  'mm', // Microsoft
  'oi', // Tinder
  'ts', // PayPal
  'uk', // Airbnb
  'mt', // Steam
];
const POLL_INTERVAL = 5000;
const MAX_POLLS = 12;

const popularRank = code => {
  const index = POPULAR_SERVICES.indexOf(code);
  return index === -1 ? POPULAR_SERVICES.length : index;
};

export default function SMSMessagingReceivedPage(props) {
  const { sendWebViewRequest } = useWebView();
  const selectedCountry = props.route.params?.selectedCountry ?? {
    value: 999,
    label: 'Auto Select',
    iso: 'WW',
  };
  const location = toSms4SatsCountryId(selectedCountry.value);
  const [services, setServices] = useState([]);
  const { publicKey, contactsPrivateKey } = useKeysContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sparkInformation } = useSparkWallet();
  const { fiatStats } = useNodeContext();
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const { decodedMessages, toggleGlobalAppDataInformation } =
    useGlobalAppData();
  // { status: 'ready' | 'unavailable' | 'pending', number, title, paidSats }
  const [result, setResult] = useState(null);
  const { showToast } = useToast();
  const { bottomPadding } = useGlobalInsets();
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const navigate = useNavigation();
  const { tokens } = GetThemeColors();
  const contentWidth = useContentWidth();
  const [purchaseMessage, setPurchaseMessage] = useState('');
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  const filteredList = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    return services.filter(item => item.name.toLowerCase().includes(query));
  }, [searchInput, services]);

  useEffect(() => {
    async function fetchServices() {
      try {
        setIsLoadingServices(true);
        const data = await fetchSms4Sats(
          `${SMS4SATS_API}/v2/receive-sms/catalog?country=${encodeURIComponent(
            location,
          )}`,
        );
        setServices(
          (data.services || [])
            .map(item => ({ ...item, name: item.name.trim() }))
            .sort((a, b) => popularRank(a.code) - popularRank(b.code)),
        );
      } catch (err) {
        console.log(err);
        navigate.navigate('ErrorScreen', {
          errorMessage: t('apps.sms4sats.receivePage.fetchServicesError'),
        });
      } finally {
        setIsLoadingServices(false);
      }
    }
    fetchServices();
  }, [navigate, t, location]);

  const saveMessagesToDB = useCallback(
    messageObject => {
      const em = encriptMessage(
        contactsPrivateKey,
        publicKey,
        JSON.stringify(messageObject),
      );
      return toggleGlobalAppDataInformation({ messagesApp: em }, true);
    },
    [contactsPrivateKey, publicKey, toggleGlobalAppDataInformation],
  );

  // Called by the confirm sheet with the order it created and priced.
  const handlePurchase = useCallback(
    async invoiceInfo => {
      const original = JSON.parse(
        JSON.stringify(decodedMessages || { sent: [], received: [] }),
      );
      if (!Array.isArray(original.received)) original.received = [];
      const fee = invoiceInfo.fee + invoiceInfo.supportFee;
      const pendingOrder = {
        orderId: invoiceInfo.orderId,
        accessToken: invoiceInfo.accessToken,
        serviceCode: invoiceInfo.serviceCode,
        title: invoiceInfo.title,
        isPending: true,
        isRefunded: false,
        createdAt: Date.now(),
      };
      const withOrder = update => ({
        ...original,
        received: [...original.received, { ...pendingOrder, ...update }],
      });

      try {
        setPurchaseMessage(t('apps.sms4sats.sendPage.payingMessage'));
        // The access token is the only way back to this order: keep it
        // before paying (docs: persist it before navigating away).
        await saveMessagesToDB(withOrder({}));

        const paymentResponse = await sendStorePayment({
          invoice: invoiceInfo.payreq,
          masterInfoObject,
          sendingAmountSats: invoiceInfo.amountSat,
          paymentType: 'lightning',
          fee,
          userBalance: sparkInformation.balance,
          sparkInformation,
          description: t('apps.sms4sats.receivePage.paymentMemo'),
          currentWalletMnemoinc,
          sendWebViewRequest,
        });
        if (!paymentResponse.didWork) {
          await saveMessagesToDB(original);
          throw new Error(t('errormessages.paymentError'));
        }

        // The payment is a hold invoice: it stays pending until the code
        // arrives and is released if no number can be allocated.
        setPurchaseMessage(t('apps.sms4sats.receivePage.orderDetailsLoading'));
        let order = null;
        for (let poll = 0; poll < MAX_POLLS; poll++) {
          try {
            order = await fetchReceiveOrder(
              invoiceInfo.orderId,
              invoiceInfo.accessToken,
            );
            if (
              order.phoneNumber ||
              RECEIVE_TERMINAL_STATES.includes(order.status)
            ) {
              break;
            }
          } catch (err) {
            console.log('Error fetching order details', err);
          }
          await new Promise(res => setTimeout(res, POLL_INTERVAL));
        }

        const baseResult = {
          title: invoiceInfo.title,
          paidSats: invoiceInfo.amountSat + fee,
        };
        if (order?.phoneNumber) {
          await saveMessagesToDB(
            withOrder({
              number: order.phoneNumber,
              country: order.countryName,
              countryIsoCode: order.countryIsoCode,
            }),
          );
          setResult({
            ...baseResult,
            status: 'ready',
            number: order.phoneNumber,
          });
        } else if (RECEIVE_TERMINAL_STATES.includes(order?.status)) {
          await saveMessagesToDB(
            withOrder({ isPending: false, isRefunded: true }),
          );
          setResult({ ...baseResult, status: 'unavailable' });
        } else {
          setResult({ ...baseResult, status: 'pending' });
        }
      } catch (err) {
        console.log('error purchasing code', err);
        navigate.navigate('ErrorScreen', { errorMessage: err.message });
      } finally {
        setPurchaseMessage('');
      }
    },
    [
      sparkInformation,
      currentWalletMnemoinc,
      masterInfoObject,
      saveMessagesToDB,
      decodedMessages,
      sendWebViewRequest,
      navigate,
      t,
    ],
  );

  const handleItemSelector = useCallback(
    async item => {
      setTimeout(
        () => {
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'confirmSMSReceive',
            serviceCode: item.code,
            location,
            countryLabel: selectedCountry.label,
            title: item.name,
            getReceiveCode: handlePurchase,
          });
        },
        KeyboardController.isVisible() ? KEYBOARDTIMEOUT : 0,
      );
      await KeyboardController.dismiss();
    },
    [navigate, handlePurchase, location, selectedCountry.label],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        onPress={() => handleItemSelector(item)}
        style={[styles.tile, { backgroundColor: tokens.surface }]}
      >
        <DiscText
          text={item.name.charAt(0).toUpperCase()}
          size={40}
          tone="primaryLight"
        />
        <ThemeText
          content={item.name}
          styles={styles.tileText}
          CustomNumberOfLines={1}
        />
      </TouchableOpacity>
    ),
    [handleItemSelector, tokens.surface],
  );

  const done = useCallback(() => {
    navigate.popTo('AppStorePageIndex', { page: 'sms4sats' });
  }, [navigate]);

  const handleBackPress = useCallback(() => {
    if (result) {
      done();
      return true;
    }
    return false;
  }, [result, done]);

  useHandleBackPressNew(handleBackPress);

  if (result) {
    return (
      <SMSNumberResult
        result={result}
        contentWidth={contentWidth}
        onDone={done}
        paidText={displayCorrectDenomination({
          amount: result.paidSats,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'sats',
          },
          fiatStats,
        })}
        onCopy={number => copyToClipboard(number, showToast)}
      />
    );
  }

  if (purchaseMessage) {
    return (
      <FullLoadingScreen
        text={purchaseMessage}
        textStyles={{ textAlign: 'center' }}
      />
    );
  }

  return (
    <CustomKeyboardAvoidingView
      useStandardWidth={true}
      isKeyboardActive={isKeyboardActive}
      useLocalPadding={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('constants.receive')} shouldDismissKeyboard={true} />
        <PageHeader
          title={t('apps.sms4sats.receivePage.serviceStepTitle')}
          sub={t('apps.sms4sats.receivePage.serviceStepSubtitle')}
        />
        <View style={[styles.countryPill, { backgroundColor: tokens.surface }]}>
          {selectedCountry.iso === 'WW' ? (
            <ThemeIcon
              redesign
              iconName="Globe"
              size={16}
              colorOverride={tokens.ink}
            />
          ) : (
            <CountryFlag isoCode={selectedCountry.iso} size={12} />
          )}
          <ThemeText
            styles={styles.countryText}
            content={selectedCountry.label}
          />
        </View>
        <SearchField
          value={searchInput}
          onChangeText={setSearchInput}
          onFocus={() => setIsKeyboardActive(true)}
          onBlur={() => setIsKeyboardActive(false)}
          placeholder={t('apps.sms4sats.receivePage.inputPlaceholder')}
          pill
        />
        {isLoadingServices ? (
          <FullLoadingScreen
            text={t('apps.sms4sats.receivePage.locationLoadingMessage')}
          />
        ) : filteredList.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState
              icon="SearchX"
              title={t('apps.sms4sats.receivePage.noAvailableServices')}
            />
          </View>
        ) : (
          <FlatList
            data={filteredList}
            renderItem={renderItem}
            keyExtractor={item => item.code}
            numColumns={3}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={21}
            maxToRenderPerBatch={21}
            windowSize={5}
            contentContainerStyle={{
              paddingTop: 16,
              paddingBottom: bottomPadding,
              gap: 10,
            }}
          />
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );
}

// "Your number is ready", or the no-number / still-allocating outcome.
function SMSNumberResult({ result, contentWidth, onDone, paidText, onCopy }) {
  const { t } = useTranslation();
  const { tokens } = GetThemeColors();
  const isReady = result.status === 'ready';

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar onBack={onDone} />
        {isReady ? (
          <CustomScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.resultScroll}
          >
            <PageHeader
              title={t('apps.sms4sats.confirmCodePage.header')}
              sub={t('apps.sms4sats.confirmCodePage.paidSubtitle', {
                title: result.title,
                amount: paidText,
              })}
            />
            <View
              style={[styles.numberCard, { backgroundColor: tokens.surface }]}
            >
              <ThemeText
                styles={[styles.numberLabel, { color: tokens.muted }]}
                content={t('apps.sms4sats.confirmCodePage.phoneNumberLabel')}
              />
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.number}
                content={formatSmsPhoneNumber(result.number)}
              />
              <CustomButton
                size="small"
                tone="secondary"
                icon="Copy"
                textContent={t('constants.copy')}
                actionFunction={() => onCopy(result.number)}
              />
            </View>
            {[
              t('apps.sms4sats.confirmCodePage.step1', {
                title: result.title,
              }),
              t('apps.sms4sats.confirmCodePage.step2'),
              t('apps.sms4sats.confirmCodePage.step3'),
            ].map((step, index) => (
              <View key={index} style={styles.step}>
                <DiscText text={`${index + 1}`} size={28} />
                <ThemeText styles={styles.stepText} content={step} />
              </View>
            ))}
          </CustomScrollView>
        ) : (
          <View style={styles.empty}>
            <Disc
              icon={result.status === 'pending' ? 'Clock' : 'Info'}
              size={72}
              iconSize={32}
            />
            <ThemeText
              styles={styles.resultText}
              content={
                result.status === 'pending'
                  ? t('apps.sms4sats.confirmCodePage.stillAllocating')
                  : t('apps.sms4sats.confirmCodePage.automaticRefund')
              }
            />
          </View>
        )}
        <CustomButton
          size="regular"
          textContent={t('constants.done')}
          actionFunction={onDone}
        />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  countryText: {
    fontSize: 13,
    includeFontPadding: false,
  },
  row: {
    gap: 10,
  },
  tile: {
    flex: 1 / 3,
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 8,
  },
  tileText: {
    fontSize: 12,
    textAlign: 'center',
    includeFontPadding: false,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultScroll: {
    paddingBottom: 20,
  },
  numberCard: {
    alignItems: 'center',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  numberLabel: {
    fontSize: 14,
    includeFontPadding: false,
  },
  number: {
    fontFamily: FONT.Title_Medium,
    fontSize: 28,
    lineHeight: 36,
    marginTop: 6,
    marginBottom: 14,
    includeFontPadding: false,
    textAlign: 'center',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  resultText: {
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 12,
  },
});
