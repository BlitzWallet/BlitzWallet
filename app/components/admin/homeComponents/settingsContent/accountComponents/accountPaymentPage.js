import {useNavigation} from '@react-navigation/native';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useEffect, useState} from 'react';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  unstable_batchedUpdates,
  View,
} from 'react-native';
import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../../functions/CustomElements/button';
import {breezPaymentWrapper} from '../../../../../functions/SDK';
import {
  getMeltQuote,
  payLnInvoiceFromEcash,
} from '../../../../../functions/eCash/wallet';
import {breezLiquidPaymentWrapper} from '../../../../../functions/breezLiquid';
import {CENTER, COLORS, SIZES} from '../../../../../constants';
import {useTranslation} from 'react-i18next';
import useDebounce from '../../../../../hooks/useDebounce';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import calculateMaxAccountTransfer from './functions/calculateMaxSend';

export default function AccountPaymentPage(props) {
  const navigate = useNavigation();
  const {masterInfoObject} = useGlobalContextProvider();
  const {nodeInformation} = useNodeContext();
  const {theme} = useGlobalThemeContext();
  const {textColor} = GetThemeColors();
  const [sendingAmount, setSendingAmount] = useState('');
  const [isDoingTransfer, setIsDoingTransfer] = useState(false);
  const [paymentFee, setPaymentFee] = useState({
    isCalculating: false,
    fee: 0,
  });

  const {t} = useTranslation();

  const {transferType, account, custodyAccountInfo} = props?.route?.params;
  console.log(transferType);

  const convertedSendAmount =
    masterInfoObject.userBalanceDenomination != 'fiat'
      ? Math.round(Number(sendingAmount))
      : Math.round(
          (SATSPERBITCOIN / nodeInformation?.fiatStats?.value) *
            Number(sendingAmount),
        );

  const sendingBalance =
    transferType === 'send' ? custodyAccountInfo?.balance : 0; //replace 0 with sparkInformation context

  const maxBankTransfer = sendingBalance - paymentFee.fee;

  const canDoTransfer = sendingBalance > maxBankTransfer;

  const debouncedSearch = useDebounce(async () => {
    console.log('RUNNING');
    // Calculate spark payment fee here

    const feeResponse = await calculateMaxAccountTransfer(
      convertedSendAmount,
      masterInfoObject,
      custodyAccountInfo?.sparkAddress,
    );

    setPaymentFee(prev => ({...prev, isCalculating: false, fee: feeResponse}));
  }, 500);

  const handleSearch = num => {
    setPaymentFee(prev => ({...prev, isCalculating: true}));
    setSendingAmount(num);
    debouncedSearch();
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={'Transfer'} />
      {isDoingTransfer ? (
        <FullLoadingScreen
          textStyles={{textAlign: 'center'}}
          text={'Handling transfer'}
        />
      ) : (
        <>
          <ScrollView style={{width: '100%', flex: 1}}>
            <View style={styles.transferAccountRow}>
              <ThemeText content={'Transfer from:'} />
              <ThemeText
                content={
                  transferType === 'send' ? account.name : 'Admin Wallet'
                }
              />
            </View>
            <View style={styles.transferAccountRow}>
              <ThemeText content={'Transfer to:'} />
              <TouchableOpacity
                activeOpacity={1}
                style={styles.chooseAccountBTN}>
                <ThemeText
                  content={
                    transferType === 'send' ? 'Admin Wallet' : account.name
                  }
                />
              </TouchableOpacity>
            </View>
            <FormattedBalanceInput
              customTextInputContainerStyles={{marginTop: 20}}
              maxWidth={0.9}
              amountValue={sendingAmount}
              inputDenomination={masterInfoObject.userBalanceDenomination}
            />

            <FormattedSatText
              containerStyles={{opacity: !sendingAmount ? 0.5 : 1}}
              neverHideBalance={true}
              styles={{includeFontPadding: false}}
              globalBalanceDenomination={
                masterInfoObject.userBalanceDenomination === 'sats' ||
                masterInfoObject.userBalanceDenomination === 'hidden'
                  ? 'fiat'
                  : 'sats'
              }
              balance={convertedSendAmount}
            />
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              width: '100%',
              justifyContent: 'center',
            }}>
            <FormattedSatText
              neverHideBalance={true}
              frontText={`Max send amount: `}
              balance={paymentFee.fee}
              styles={{textAlign: 'center'}}
            />
            <FullLoadingScreen
              showLoadingIcon={paymentFee.isCalculating}
              containerStyles={{
                flex: 0,
                marginLeft: 5,
              }}
              size="small"
              showText={false}
              loadingColor={theme ? textColor : COLORS.primary}
            />
          </View>

          <CustomNumberKeyboard
            showDot={masterInfoObject.userBalanceDenomination === 'fiat'}
            frompage="sendContactsPage"
            setInputValue={handleSearch}
            usingForBalance={true}
            nodeInformation={nodeInformation}
          />

          <CustomButton
            textContent={t('constants.confirm')}
            buttonStyles={{
              ...CENTER,
              opacity: !canDoTransfer || !sendingAmount ? 0.2 : 1,
            }}
            actionFunction={() => {
              if (!canDoTransfer) return;
              if (!sendingAmount) return;
              //   Navigat to half modal here
            }}
          />
        </>
      )}
    </GlobalThemeView>
  );
  async function initiateTransfer({invoice, transferInfo}) {
    try {
      setIsDoingTransfer(true);
      //   Send payment here
    } catch (err) {
      console.log('send tranfer error', err);
    }
  }
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarText: {
    fontSize: SIZES.xLarge,
    width: '100%',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.halfModalBackgroundColor,
  },
  absolute: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  contentContainer: {
    width: '90%',
    backgroundColor: COLORS.darkModeText,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  transferAccountRow: {
    width: '90%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    alignItems: 'center',
    ...CENTER,
  },
  chooseAccountBTN: {
    flexDirection: 'row',
    alignItems: 'center',
    includeFontPadding: false,
  },
  chooseAccountImage: {
    height: 20,
    width: 10,
    transform: [{rotate: '180deg'}],
    marginLeft: 5,
  },
  textInputContainer: {
    margin: 0,
    marginTop: 10,
    ...CENTER,
  },
});
