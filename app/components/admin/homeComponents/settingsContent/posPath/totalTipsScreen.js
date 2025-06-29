import {
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  CENTER,
  COLORS,
  EMAIL_REGEX,
  ICONS,
  POINT_OF_SALE_PAYOUT_DESCRIPTION,
  SIZES,
} from '../../../../../constants';
import {ThemeText} from '../../../../../functions/CustomElements';
import {useNavigation} from '@react-navigation/native';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {formatDateToDayMonthYear} from '../../../../../functions/rotateAddressDateChecker';
import CustomButton from '../../../../../functions/CustomElements/button';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {useCallback, useMemo, useState} from 'react';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {useGlobalContacts} from '../../../../../../context-store/globalContacts';
import {
  payPOSContact,
  // payPOSLiquid,
  payPOSLNURL,
} from '../../../../../functions/pos/payments';
import {useGlobaleCash} from '../../../../../../context-store/eCash';
import customUUID from '../../../../../functions/customUUID';
import {publishMessage} from '../../../../../functions/messaging/publishMessage';
import {useKeysContext} from '../../../../../../context-store/keys';
import {getFiatRates} from '../../../../../functions/SDK';
import {bulkUpdateDidPay, deleteEmployee} from '../../../../../functions/pos';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
import TipsTXItem from './internalComponents/tipTx';
import {usePOSTransactions} from '../../../../../../context-store/pos';
import {useWebView} from '../../../../../../context-store/webViewContext';
import {useSparkWallet} from '../../../../../../context-store/sparkContext';

export default function TotalTipsScreen(props) {
  const {decodedAddedContacts, globalContactsInformation} = useGlobalContacts();
  const {groupedTxs} = usePOSTransactions();
  const [wantedName, {}] = props.route?.params?.item;

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
  ] = groupedTxs.find(item => item[0] === wantedName);

  const {theme, darkModeType} = useGlobalThemeContext();
  const {contactsPrivateKey} = useKeysContext();
  const {fiatStats} = useNodeContext();
  const {sparkInformation} = useSparkWallet();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {masterInfoObject} = useGlobalContextProvider();
  const navigate = useNavigation();
  const height = useWindowDimensions().height;
  const {backgroundColor, backgroundOffset} = GetThemeColors();
  const [paymentUpdate, setPaymentUpdate] = useState({
    isSending: false,
    errorMessage: '',
    updateMessage: '',
    didComplete: false,
  });
  const [viewTips, setViewTips] = useState(false);
  const {webViewRef} = useWebView();

  // const eCashBalance = ecashWalletInformation.balance;

  const handlePayment = useCallback(async () => {
    try {
      if (totalTipAmount < minMaxLiquidSwapAmounts.min) {
        navigate.navigate('ErrorScreen', {
          errorMessage: `Must have over ${displayCorrectDenomination({
            amount: minMaxLiquidSwapAmounts.min,
            masterInfoObject,
            fiatStats,
          })} in order payout tips.`,
        });
        return;
      }
      setPaymentUpdate(prev => ({...prev, isSending: true}));
      const fiatCurrencies = await getFiatRates();
      const blitzContact = decodedAddedContacts?.find(
        contact => contact?.uniqueName?.toLowerCase() === name?.toLowerCase(),
      );
      if (blitzContact) {
        //  use pay pos contact payment here
        // const address = blitzContact.receiveAddress;
        const pubKey = blitzContact.uuid;
        const fromPubKey = globalContactsInformation.myProfile.uuid;

        setPaymentUpdate(prev => ({
          ...prev,
          updateMessage: `Paying...`,
        }));
        // is blitz contact
        const paymentResponse = await payPOSContact({
          blitzContact,
          sendingAmountSats: totalTipAmount,
          masterInfoObject,
          description: POINT_OF_SALE_PAYOUT_DESCRIPTION,
          webViewRef,
          sparkInformation,
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
        if (paymentResponse) {
          setPaymentUpdate(prev => ({
            ...prev,
            updateMessage: `Notifiying...`,
          }));
          // First notify employee that tips have been paid and update contacts transactions
          const UUID = customUUID();
          const sendObject = {
            amountMsat: totalTipAmount * 1000,
            description: POINT_OF_SALE_PAYOUT_DESCRIPTION,
            uuid: UUID,
            isRequest: false,
            isRedeemed: null,
            wasSeen: null,
            didSend: null,
          };

          await publishMessage({
            toPubKey: pubKey,
            fromPubKey: fromPubKey,
            data: sendObject,
            globalContactsInformation,
            selectedContact: blitzContact,
            fiatCurrencies,
            isLNURLPayment: false,
            privateKey: contactsPrivateKey,
          });
          // update internal db state of paid tips so you dont pay a tip twice
          await updateInteralDBState(unpaidTxs);
        } else throw new Error('Unable to pay blitz contact. Try again later.');
      } else if (EMAIL_REGEX.test(name)) {
        // is lnurl
        setPaymentUpdate(prev => ({
          ...prev,
          updateMessage: `Paying...`,
        }));
        const didPay = await payPOSLNURL({
          LNURLAddress: name,
          sendingAmountSats: totalTipAmount,
          masterInfoObject,
          description: POINT_OF_SALE_PAYOUT_DESCRIPTION,
          sparkInformation,
          // liquidNodeInformation,
          // nodeInformation,
          // minMaxLiquidSwapAmounts,
        });
        if (didPay) {
          await updateInteralDBState(unpaidTxs);
        } else throw new Error('Unable to pay LNURL address. Try again later.');
      } else
        throw new Error(
          'Name is not an LNURL or an addded Blitz contact. Please add this user as a contact or ask for a valid LNURL.',
        );
    } catch (err) {
      console.log('handle tips payment error', err);
      navigate.navigate('ErrorScreen', {errorMessage: err.message});
    } finally {
      setPaymentUpdate(prev => ({...prev, isSending: false}));
    }
  }, [
    minMaxLiquidSwapAmounts,
    decodedAddedContacts,
    name,
    totalTipAmount,
    unpaidTxs,
  ]);

  const updateInteralDBState = useCallback(async txList => {
    const dateAddedArray = txList.map(tx => tx.dbDateAdded);
    await bulkUpdateDidPay(dateAddedArray);
  }, []);

  const renderItem = useCallback(
    ({item}) => {
      return (
        <TipsTXItem
          item={item}
          masterInfoObject={masterInfoObject}
          fiatStats={fiatStats}
        />
      );
    },
    [masterInfoObject, fiatStats],
  );

  const viewHeight = useMemo(() => height * 0.5, [height]);
  const removeEmployee = useCallback(async name => {
    navigate.navigate('ConfirmActionPage', {
      confirmMessage: 'Are you sure you want to remove this employee?',
      confirmFunction: async () => {
        await deleteEmployee(name);
        navigate.popTo('ViewPOSTransactions');
      },
    });
  }, []);

  return (
    <View style={styles.container}>
      <View
        style={{
          ...styles.contentContainer,
          backgroundColor:
            theme && darkModeType ? backgroundOffset : backgroundColor,
          height: viewHeight,
        }}>
        {!paymentUpdate.isSending && (
          <View style={styles.navBarButtons}>
            {!viewTips && (
              <TouchableOpacity onPress={() => removeEmployee(name)}>
                <ThemeImage
                  styles={{width: 23, height: 23}}
                  lightModeIcon={ICONS.trashIcon}
                  darkModeIcon={ICONS.trashIcon}
                  lightsOutIcon={ICONS.trashIconWhite}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                if (viewTips) setViewTips(false);
                else navigate.goBack();
              }}>
              <ThemeImage
                lightModeIcon={
                  viewTips ? ICONS.smallArrowLeft : ICONS.xSmallIcon
                }
                darkModeIcon={
                  viewTips ? ICONS.smallArrowLeft : ICONS.xSmallIcon
                }
                lightsOutIcon={
                  viewTips
                    ? ICONS.arrow_small_left_white
                    : ICONS.xSmallIconWhite
                }
              />
            </TouchableOpacity>
          </View>
        )}
        {paymentUpdate.isSending ? (
          <>
            <FullLoadingScreen
              textStyles={{textAlign: 'center'}}
              text={
                paymentUpdate.errorMessage ||
                paymentUpdate.updateMessage ||
                'Begining payment process, please do not leave this page or the app.'
              }
              containerStyles={{height: 250}}
            />
            {paymentUpdate.didComplete && (
              <CustomButton textContent={'Go back'} />
            )}
          </>
        ) : viewTips ? (
          <FlatList
            contentContainerStyle={{paddingTop: 10, paddingBottom: 20}}
            data={txs}
            keyExtractor={item => item.dbDateAdded.toString()}
            renderItem={renderItem}
          />
        ) : (
          <>
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.employeeName}
              content={name}
            />
            <ScrollView contentContainerStyle={{paddingBottom: 20}}>
              <View style={styles.attributeContainer}>
                <ThemeText CustomNumberOfLines={1} content={`Last sale:`} />
                <ThemeText
                  content={`${formatDateToDayMonthYear(lastActivity)}`}
                />
              </View>
              <View style={styles.attributeContainer}>
                <ThemeText
                  CustomNumberOfLines={1}
                  content={`Number of tips paid:`}
                />
                <ThemeText content={`${totalPaidTxs}`} />
              </View>
              <View style={styles.attributeContainer}>
                <ThemeText
                  CustomNumberOfLines={1}
                  content={`Number of unpaid tips:`}
                />
                <ThemeText content={`${totalUnpaidTxs}`} />
              </View>
              <View style={styles.attributeContainer}>
                <ThemeText
                  CustomNumberOfLines={1}
                  content={`Current tip balance:`}
                />
                <ThemeText
                  content={`${displayCorrectDenomination({
                    amount: totalTipAmount,
                    masterInfoObject,
                    fiatStats,
                  })}`}
                />
              </View>
            </ScrollView>

            <CustomButton actionFunction={handlePayment} textContent={'Pay'} />
            <CustomButton
              actionFunction={() => setViewTips(true)}
              textContent={'View Tips'}
              buttonStyles={{marginTop: 10}}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.halfModalBackgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    width: INSET_WINDOW_WIDTH,
    padding: 10,
    borderRadius: 8,
  },

  employeeName: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: SIZES.large,
    textTransform: 'capitalize',
  },
  attributeContainer: {
    width: '90%',
    marginBottom: 20,
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
  },
});
