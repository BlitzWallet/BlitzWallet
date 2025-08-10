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
  const sendingAmount = props?.route?.params?.amount || 0;
  const [transferInfo, setTransferInfo] = useState({
    from: '',
    fromBalance: 0,
    to: '',
    isDoingTransfer: false,
    isCalculatingFee: false,
    paymentFee: 0,
  });
  const {backgroundOffset} = GetThemeColors();
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
            <ThemeImage
              styles={{
                transform: [{rotate: '90deg'}],
                ...CENTER,
                marginTop: 20,
                marginBottom: 20,
              }}
              lightModeIcon={ICONS.exchangeIcon}
              darkModeIcon={ICONS.exchangeIcon}
              lightsOutIcon={ICONS.exchangeIconWhite}
            />
            <TouchableOpacity
              onPress={() => {
                navigate.navigate('CustomHalfModal', {
                  wantedContent: 'customInputText',
                  returnLocation: 'CustodyAccountPaymentPage',
                  sliderHight: 0.5,
                });
              }}>
              <FormattedBalanceInput
                maxWidth={0.9}
                amountValue={sendingAmount}
                inputDenomination={masterInfoObject.userBalanceDenomination}
              />

              <FormattedSatText
                containerStyles={{
                  opacity: !sendingAmount ? 0.5 : 1,
                  marginBottom: 30,
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
            </TouchableOpacity>

            <View
              style={{
                ...styles.transferAccountRow,
                borderBottomColor: backgroundOffset,
              }}>
              <View style={styles.transferTextContainer}>
                <ThemeImage
                  styles={{
                    ...styles.transferTextIcon,
                    transform: [{rotate: '-90deg'}],
                  }}
                  lightModeIcon={ICONS.arrowFromRight}
                  darkModeIcon={ICONS.arrowFromRight}
                  lightsOutIcon={ICONS.arrowFromRightWhite}
                />
                <ThemeText content={'From'} />
              </View>
              <TouchableOpacity
                onPress={() => {
                  navigate.navigate('CustomHalfModal', {
                    wantedContent: 'SelectAltAccount',
                    sliderHight: 0.5,
                    selectedFrom: transferInfo.from,
                    selectedTo: transferInfo.to,
                    transferType: 'from',
                  });
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginLeft: 10,
                  flexShrink: 1,
                }}>
                <ThemeText
                  content={
                    transferInfo.from ? transferInfo.from : 'Select Account'
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
            <View
              style={{
                ...styles.transferAccountRow,
                borderBottomColor: backgroundOffset,
              }}>
              <View style={styles.transferTextContainer}>
                <ThemeImage
                  styles={{
                    ...styles.transferTextIcon,
                    transform: [{rotate: '90deg'}],
                  }}
                  lightModeIcon={ICONS.arrowToRight}
                  darkModeIcon={ICONS.arrowToRight}
                  lightsOutIcon={ICONS.arrowToRightLight}
                />
                <ThemeText content={'To'} />
              </View>
              <TouchableOpacity
                style={styles.chooseAccountBTN}
                onPress={() => {
                  navigate.navigate('CustomHalfModal', {
                    wantedContent: 'SelectAltAccount',
                    sliderHight: 0.5,
                    selectedFrom: transferInfo.from,
                    selectedTo: transferInfo.to,
                    transferType: 'to',
                  });
                }}>
                <ThemeText
                  content={
                    transferInfo.from ? transferInfo.from : 'Select Account'
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
            <View
              style={{
                ...styles.transferAccountRow,
                borderBottomColor: backgroundOffset,
              }}>
              <View style={styles.transferTextContainer}>
                <ThemeImage
                  styles={{
                    ...styles.transferTextIcon,
                  }}
                  lightModeIcon={ICONS.receiptIcon}
                  darkModeIcon={ICONS.receiptIcon}
                  lightsOutIcon={ICONS.receiptWhite}
                />
                <ThemeText content={'Fee'} />
              </View>

              {transferInfo.isCalculatingFee ? (
                <FullLoadingScreen
                  containerStyles={{
                    flex: 0,
                  }}
                  size="small"
                  showText={false}
                  loadingColor={theme ? textColor : COLORS.primary}
                />
              ) : (
                <FormattedSatText
                  neverHideBalance={true}
                  styles={{includeFontPadding: false}}
                  balance={transferInfo.paymentFee}
                />
              )}
            </View>
          </ScrollView>

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
  transferTextContainer: {flexDirection: 'row', alignItems: 'center'},
  transferTextIcon: {
    width: 20,
    height: 20,
    marginRight: 5,
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
    borderBottomWidth: 1,
    paddingBottom: 10,
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
