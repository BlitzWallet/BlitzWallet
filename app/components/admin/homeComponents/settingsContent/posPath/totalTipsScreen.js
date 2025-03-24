import {
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
import {useCallback, useState} from 'react';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {useGlobalContacts} from '../../../../../../context-store/globalContacts';
import {payPOSLiquid, payPOSLNURL} from '../../../../../functions/pos/payments';
import {useGlobaleCash} from '../../../../../../context-store/eCash';
import customUUID from '../../../../../functions/customUUID';
import {publishMessage} from '../../../../../functions/messaging/publishMessage';
import {useKeysContext} from '../../../../../../context-store/keys';
import {getFiatRates} from '../../../../../functions/SDK';
import {bulkUpdateDidPay} from '../../../../../functions/pos';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';

export default function TotalTipsScreen(props) {
  const {decodedAddedContacts, globalContactsInformation} = useGlobalContacts();
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
  ] = props.route?.params?.item;
  const {theme, darkModeType} = useGlobalThemeContext();
  const {contactsPrivateKey} = useKeysContext();
  const {liquidNodeInformation, nodeInformation} = useNodeContext();
  const {ecashWalletInformation} = useGlobaleCash();

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

  console.log(name);
  const eCashBalance = ecashWalletInformation.balance;

  const handlePayment = useCallback(async () => {
    try {
      if (totalTipAmount < minMaxLiquidSwapAmounts.min) {
        navigate.navigate('ErrorScreen', {
          errorMessage: `Minimum tip balance is ${displayCorrectDenomination({
            amount: minMaxLiquidSwapAmounts.min,
            nodeInformation,
            masterInfoObject,
          })}.`,
        });
        return;
      }
      setPaymentUpdate(prev => ({...prev, isSending: true}));
      const fiatCurrencies = await getFiatRates();
      const blitzContact = decodedAddedContacts?.find(
        contact => contact?.uniqueName?.toLowerCase() === name?.toLowerCase(),
      );
      if (blitzContact) {
        const address = blitzContact.receiveAddress;
        const pubKey = blitzContact.uuid;
        const fromPubKey = globalContactsInformation.myProfile.uuid;

        setPaymentUpdate(prev => ({
          ...prev,
          updateMessage: `Paying...`,
        }));
        // is blitz contact
        const didPay = await payPOSLiquid({
          liquidNodeInformation,
          eCashBalance,
          nodeInformation,
          address, // liquid address
          payingStateUpdate: setPaymentUpdate,
          minMaxLiquidSwapAmounts,
          sendingAmountSats: totalTipAmount,
          masterInfoObject,
          description: POINT_OF_SALE_PAYOUT_DESCRIPTION,
        });
        if (didPay) {
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
          liquidNodeInformation,
          nodeInformation,
          LNURLAddress: name,
          minMaxLiquidSwapAmounts,
          sendingAmountSats: totalTipAmount,
          masterInfoObject,
          description: POINT_OF_SALE_PAYOUT_DESCRIPTION,
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

  return (
    <View style={styles.container}>
      <View
        style={{
          ...styles.contentContainer,
          backgroundColor:
            theme && darkModeType ? backgroundOffset : backgroundColor,
          maxHeight: height * 0.5,
        }}>
        {paymentUpdate.isSending ? (
          <View style={{height: 250}}>
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
          </View>
        ) : (
          <>
            <TouchableOpacity
              onPress={navigate.goBack}
              style={styles.cancelButton}>
              <ThemeImage
                lightModeIcon={ICONS.xSmallIcon}
                darkModeIcon={ICONS.xSmallIcon}
                lightsOutIcon={ICONS.xSmallIconWhite}
              />
            </TouchableOpacity>
            <ThemeText
              CustomNumberOfLines={1}
              styles={{
                textAlign: 'center',
                marginBottom: 20,
                fontSize: SIZES.large,
              }}
              content={name}
            />
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
                  nodeInformation,
                })}`}
              />
            </View>

            <CustomButton actionFunction={handlePayment} textContent={'Pay'} />
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
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBlockColor: COLORS.halfModalBackgroundColor,
    borderBottomWidth: 1,
  },
  name: {
    textTransform: 'capitalize',
    flex: 1,
    marginRight: 10,
  },
  cancelButton: {
    marginLeft: 'auto',
  },
  attributeContainer: {
    width: '90%',
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...CENTER,
  },
});
