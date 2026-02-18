import {
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CENTER,
  COLORS,
  EMAIL_REGEX,
  POINT_OF_SALE_PAYOUT_DESCRIPTION,
  SIZES,
} from '../../../../../constants';
import { ThemeText } from '../../../../../functions/CustomElements';
import { useNavigation } from '@react-navigation/native';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { formatDateToDayMonthYear } from '../../../../../functions/rotateAddressDateChecker';
import CustomButton from '../../../../../functions/CustomElements/button';
import { useCallback, useMemo, useState } from 'react';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { useGlobalContacts } from '../../../../../../context-store/globalContacts';
import {
  payPOSContact,
  payPOSLNURL,
} from '../../../../../functions/pos/payments';
import customUUID from '../../../../../functions/customUUID';
import { publishMessage } from '../../../../../functions/messaging/publishMessage';
import { useKeysContext } from '../../../../../../context-store/keys';
import { bulkUpdateDidPay, deleteEmployee } from '../../../../../functions/pos';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import TipsTXItem from './internalComponents/tipTx';
import { usePOSTransactions } from '../../../../../../context-store/pos';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { getSingleContact } from '../../../../../../db';
import { useServerTimeOnly } from '../../../../../../context-store/serverTime';
import { useTranslation } from 'react-i18next';
import { useWebView } from '../../../../../../context-store/webViewContext';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';

export default function TotalTipsScreen(props) {
  const { sendWebViewRequest } = useWebView();
  const { decodedAddedContacts, globalContactsInformation } =
    useGlobalContacts();
  const { screenDimensions } = useAppStatus();
  const { groupedTxs } = usePOSTransactions();
  const { t } = useTranslation();
  const [wantedName, {}] = props.route?.params?.item;

  const createdGroup = useMemo(() => {
    return groupedTxs.find(item => item[0] === wantedName) || [];
  }, [groupedTxs]);

  const [
    name,
    {
      lastActivity,
      totalPaidTxs,
      totalTipAmount,
      totalUnpaidTxs,
      txs,
      unpaidTxs,
    },
  ] = createdGroup;

  const getServerTime = useServerTimeOnly();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { contactsPrivateKey, accountMnemoinc } = useKeysContext();
  const { fiatStats } = useNodeContext();
  const { sparkInformation } = useSparkWallet();
  // const {minMaxLiquidSwapAmounts} = useAppStatus();
  const { masterInfoObject } = useGlobalContextProvider();
  const navigate = useNavigation();
  const { backgroundColor, backgroundOffset, transparentOveraly } =
    GetThemeColors();
  const [paymentUpdate, setPaymentUpdate] = useState({
    isSending: false,
    errorMessage: '',
    updateMessage: '',
    didComplete: false,
  });

  const sourtedTxs = useMemo(() => {
    try {
      if (!txs || !Array.isArray(txs)) return [];
      return [...txs].sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
    } catch (err) {
      console.log('error sorting txs', err);
      return [];
    }
  }, [txs]);

  const borderColor = useMemo(() => {
    return backgroundColor;
  }, [theme, darkModeType, backgroundOffset, backgroundColor]);

  const handlePayment = useCallback(async () => {
    try {
      if (totalTipAmount < 1) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('settings.posPath.totalTipsScreen.noTipBalanceError'),
        });
        return;
      }
      setPaymentUpdate(prev => ({ ...prev, isSending: true }));
      const [blitzContact] = await Promise.all([
        getSingleContact(name?.toLowerCase()),
      ]);

      if (blitzContact.length) {
        const selectedContact = blitzContact[0];

        if (!selectedContact.contacts.myProfile.sparkAddress)
          throw new Error(
            t('settings.posPath.totalTipsScreen.updateContactMessage'),
          );

        //  use pay pos contact payment here
        // const address = blitzContact.receiveAddress;
        const pubKey = selectedContact.uuid;
        const fromPubKey = globalContactsInformation.myProfile.uuid;

        setPaymentUpdate(prev => ({
          ...prev,
          updateMessage: t('settings.posPath.totalTipsScreen.payingMessage'),
        }));
        // is blitz contact
        const paymentResponse = await payPOSContact({
          blitzContact: selectedContact,
          sendingAmountSats: totalTipAmount,
          masterInfoObject,
          description: POINT_OF_SALE_PAYOUT_DESCRIPTION,
          // webViewRef,
          sparkInformation,
          currentWalletMnemoinc: accountMnemoinc,
          sendWebViewRequest,
        });
        // const didPay = await payPOSLiquid({
        //   liquidNodeInformation,
        //   eCashBalance,
        //   nodeInformation,
        //   address, // liquid address
        //   payingStateUpdate: setPaymentUpdate,
        //   minMaxLiquidSwapAmounts,
        //   sendingAmountSats: totalTipAmount,
        //   masterInfoObject,
        //   description: POINT_OF_SALE_PAYOUT_DESCRIPTION,
        //   webViewRef,
        // });
        if (paymentResponse.didWork) {
          setPaymentUpdate(prev => ({
            ...prev,
            updateMessage: t(
              'settings.posPath.totalTipsScreen.notifyngMessage',
            ),
          }));
          // First notify employee that tips have been paid and update contacts transactions
          const UUID = customUUID();
          const currentTime = getServerTime();
          const sendObject = {
            amountMsat: totalTipAmount * 1000,
            description: POINT_OF_SALE_PAYOUT_DESCRIPTION,
            uuid: UUID,
            isRequest: false,
            isRedeemed: null,
            wasSeen: null,
            didSend: null,
            txid: paymentResponse.paymentResponse.response.id,
            name:
              globalContactsInformation.myProfile.name ||
              globalContactsInformation.myProfile.uniqueName,
            senderProfileSnapshot: {
              uniqueName: globalContactsInformation.myProfile.uniqueName,
            },
          };

          await publishMessage({
            toPubKey: pubKey,
            fromPubKey: fromPubKey,
            data: sendObject,
            globalContactsInformation,
            selectedContact: selectedContact.contacts.myProfile,
            isLNURLPayment: false,
            privateKey: contactsPrivateKey,
            retrivedContact: selectedContact,
            currentTime,
            masterInfoObject,
          });
          // update internal db state of paid tips so you dont pay a tip twice
          await updateInteralDBState(unpaidTxs);
        } else
          throw new Error(t('settings.posPath.totalTipsScreen.errorPaying'));
      } else if (EMAIL_REGEX.test(name)) {
        // is lnurl
        setPaymentUpdate(prev => ({
          ...prev,
          updateMessage: t('settings.posPath.totalTipsScreen.payingMessage'),
        }));
        const didPay = await payPOSLNURL({
          LNURLAddress: name,
          sendingAmountSats: totalTipAmount,
          masterInfoObject,
          description: POINT_OF_SALE_PAYOUT_DESCRIPTION,
          sparkInformation,
          currentWalletMnemoinc: accountMnemoinc,
          // liquidNodeInformation,
          // nodeInformation,
          // minMaxLiquidSwapAmounts,
          sendWebViewRequest,
        });
        if (didPay) {
          await updateInteralDBState(unpaidTxs);
        } else
          throw new Error(t('settings.posPath.totalTipsScreen.errorPaying'));
      } else throw new Error(t('settings.posPath.totalTipsScreen.invalidName'));
    } catch (err) {
      console.log('handle tips payment error', err);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    } finally {
      setPaymentUpdate(prev => ({ ...prev, isSending: false }));
    }
  }, [
    // minMaxLiquidSwapAmounts,
    decodedAddedContacts,
    name,
    totalTipAmount,
    unpaidTxs,
    getServerTime,
    masterInfoObject,
    sendWebViewRequest,
  ]);

  const updateInteralDBState = useCallback(async txList => {
    const dateAddedArray = txList.map(tx => tx.dbDateAdded);
    await bulkUpdateDidPay(dateAddedArray);
  }, []);

  const renderItem = useCallback(
    ({ item, index }) => {
      return (
        <TipsTXItem
          item={item}
          masterInfoObject={masterInfoObject}
          fiatStats={fiatStats}
          t={t}
          theme={theme}
          darkModeType={darkModeType}
          backgroundColor={backgroundColor}
          backgroundOffset={backgroundOffset}
          borderColor={borderColor}
          isLastIndex={index === sourtedTxs.length - 1}
        />
      );
    },
    [
      masterInfoObject,
      fiatStats,
      t,
      theme,
      darkModeType,
      backgroundColor,
      backgroundOffset,
      borderColor,
      sourtedTxs.length,
    ],
  );

  const viewHeight = useMemo(
    () => screenDimensions.height * 0.7,
    [screenDimensions.height],
  );
  const removeEmployee = useCallback(async name => {
    navigate.navigate('ConfirmActionPage', {
      confirmMessage: t(
        'settings.posPath.totalTipsScreen.removeEmployeeWarning',
      ),
      confirmFunction: async () => {
        await deleteEmployee(name);
        navigate.popTo('ViewPOSTransactions');
      },
    });
  }, []);

  const ContainerWrapper = useCallback(
    ({ children }) => {
      return (
        <View
          style={[styles.container, { backgroundColor: transparentOveraly }]}
        >
          <View
            style={{
              ...styles.contentContainer,
              backgroundColor: backgroundOffset,
              height: viewHeight,
            }}
          >
            {children}
          </View>
        </View>
      );
    },
    [
      theme,
      darkModeType,
      backgroundOffset,
      backgroundColor,
      viewHeight,
      transparentOveraly,
    ],
  );

  if (paymentUpdate.isSending) {
    return (
      <ContainerWrapper>
        <FullLoadingScreen
          textStyles={{ textAlign: 'center' }}
          text={
            paymentUpdate.errorMessage ||
            paymentUpdate.updateMessage ||
            t('settings.posPath.totalTipsScreen.startingPaymentProcessMessage')
          }
          containerStyles={{ height: 250 }}
        />
      </ContainerWrapper>
    );
  }

  return (
    <ContainerWrapper>
      <View style={[styles.navBarButtons, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={navigate.goBack}>
          <ThemeIcon iconName={'X'} />
        </TouchableOpacity>
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.employeeName}
          content={name}
        />

        <TouchableOpacity
          onPress={() => removeEmployee(name)}
          style={{ marginLeft: 15 }}
        >
          <ThemeIcon size={25} iconName={'Trash2'} />
        </TouchableOpacity>
      </View>

      <FlatList
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 20 }}
        data={sourtedTxs}
        keyExtractor={item => item.dbDateAdded.toString()}
        renderItem={renderItem}
      />
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 20,
          paddingTop: 10,
          backgroundColor: borderColor,
          borderWidth: 2,
          borderColor: backgroundOffset,
          borderRadius: 8,
        }}
      >
        <View style={styles.attributeContainer}>
          <ThemeText
            CustomNumberOfLines={1}
            styles={{
              textTransform: 'capitalize',
              includeFontPadding: false,
            }}
            content={t('settings.posPath.totalTipsScreen.tipBalance')}
          />
          <ThemeText
            styles={{ includeFontPadding: false }}
            content={displayCorrectDenomination({
              amount: totalTipAmount,
              masterInfoObject,
              fiatStats,
            })}
          />
        </View>
        <View style={styles.attributeContainer}>
          <ThemeText
            styles={{
              textTransform: 'capitalize',
              includeFontPadding: false,
              fontSize: SIZES.smedium,
            }}
            CustomNumberOfLines={1}
            content={t('constants.paidLower')}
          />
          <ThemeText
            styles={{ includeFontPadding: false, fontSize: SIZES.smedium }}
            content={displayCorrectDenomination({
              amount: totalPaidTxs,
              masterInfoObject,
              fiatStats,
            })}
          />
        </View>
        <View style={styles.attributeContainer}>
          <ThemeText
            styles={{
              textTransform: 'capitalize',
              includeFontPadding: false,
              fontSize: SIZES.smedium,
            }}
            CustomNumberOfLines={1}
            content={t('constants.unpaidLower')}
          />
          <ThemeText
            styles={{ includeFontPadding: false, fontSize: SIZES.smedium }}
            content={displayCorrectDenomination({
              amount: totalUnpaidTxs,
              masterInfoObject,
              fiatStats,
            })}
          />
        </View>

        <CustomButton
          buttonStyles={{ marginTop: 5 }}
          actionFunction={handlePayment}
          textContent={t('constants.pay')}
        />
      </View>
    </ContainerWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    width: INSET_WINDOW_WIDTH,
    borderRadius: 8,
    overflow: 'hidden',
  },

  employeeName: {
    textAlign: 'center',
    fontSize: SIZES.large,
    marginRight: 'auto',
    marginLeft: 10,
    includeFontPadding: false,
    flexShrink: 1,
  },
  attributeContainer: {
    width: '90%',
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...CENTER,
  },
  navBarButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: 20,
    borderBottomWidth: 3,
  },
});
