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
import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import CustomNumberKeyboard from '../../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../../functions/CustomElements/button';
import {
  CENTER,
  COLORS,
  ICONS,
  SATSPERBITCOIN,
  SIZES,
} from '../../../../../constants';
import {useTranslation} from 'react-i18next';
import useDebounce from '../../../../../hooks/useDebounce';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';

export default function AccountPaymentPage(props) {
  const navigate = useNavigation();
  const {masterInfoObject} = useGlobalContextProvider();
  const {nodeInformation} = useNodeContext();
  const {theme} = useGlobalThemeContext();
  const {textColor} = GetThemeColors();
  const [sendingAmount, setSendingAmount] = useState('');
  const [transferInfo, setTransferInfo] = useState({
    from: '',
    fromBalance: 0,
    to: '',
    isDoingTransfer: false,
    isCalculatingFee: false,
    paymentFee: 0,
  });

  const {t} = useTranslation();

  const convertedSendAmount =
    masterInfoObject.userBalanceDenomination != 'fiat'
      ? Math.round(Number(sendingAmount))
      : Math.round(
          (SATSPERBITCOIN / nodeInformation?.fiatStats?.value) *
            Number(sendingAmount),
        );

  const sendingBalance = 0;
  // transferType === 'send' ? custodyAccountInfo?.balance : 0; //replace 0 with sparkInformation context

  const maxBankTransfer = sendingBalance - transferInfo.paymentFee;

  const canDoTransfer = sendingBalance > maxBankTransfer;

  const debouncedSearch = useDebounce(async () => {
    console.log('RUNNING');
    // Calculate spark payment fee here
    setTransferInfo(prev => ({...prev, isCalculatingFee: false}));
  }, 800);

  useEffect(() => {
    if (!sendingAmount) return;
    setTransferInfo(prev => ({...prev, isCalculatingFee: true}));
    debouncedSearch();
  }, [sendingAmount]);

  console.log(transferInfo);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={'Swap'} />
      {transferInfo.isDoingTransfer ? (
        <FullLoadingScreen
          textStyles={{textAlign: 'center'}}
          text={'Handling transfer'}
        />
      ) : (
        <>
          <ScrollView style={{width: '100%', flex: 1}}>
            <FormattedBalanceInput
              customTextInputContainerStyles={{marginTop: 20}}
              maxWidth={0.9}
              amountValue={sendingAmount}
              inputDenomination={masterInfoObject.userBalanceDenomination}
            />

            <FormattedSatText
              containerStyles={{
                opacity: !sendingAmount ? 0.5 : 1,
                marginBottom: 20,
              }}
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
            <View style={styles.transferAccountRow}>
              <View>
                <ThemeText content={'Transfer from:'} />
              </View>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginLeft: 10,
                  flexShrink: 1,
                }}>
                <ThemeText
                  content={
                    transferInfo.from
                      ? transferInfo.from
                      : 'Select from account'
                  }
                />
                <ThemeImage
                  styles={{
                    width: 20,
                    height: 20,
                    transform: [{rotate: '180deg'}],
                  }}
                  lightModeIcon={ICONS.leftCheveronIcon}
                  darkModeIcon={ICONS.leftCheveronIcon}
                  lightsOutIcon={ICONS.leftCheveronLight}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.transferAccountRow}>
              <ThemeText content={'Transfer to:'} />
              <TouchableOpacity style={styles.chooseAccountBTN}>
                <ThemeText
                  content={
                    transferInfo.from ? transferInfo.from : 'Select to account'
                  }
                />
                <ThemeImage
                  styles={{
                    width: 20,
                    height: 20,
                    transform: [{rotate: '180deg'}],
                  }}
                  lightModeIcon={ICONS.leftCheveronIcon}
                  darkModeIcon={ICONS.leftCheveronIcon}
                  lightsOutIcon={ICONS.leftCheveronLight}
                />
              </TouchableOpacity>
            </View>
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
              balance={transferInfo.paymentFee}
              styles={{textAlign: 'center'}}
            />
            <FullLoadingScreen
              showLoadingIcon={transferInfo.isCalculatingFee}
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
            setInputValue={setSendingAmount}
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
      setTransferInfo(prev => ({...prev, isDoingTransfer: true}));

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
