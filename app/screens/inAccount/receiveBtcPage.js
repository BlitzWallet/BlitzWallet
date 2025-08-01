import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import {CENTER, SIZES, ICONS, COLORS} from '../../constants';
import {useEffect, useRef, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {copyToClipboard} from '../../functions';
import {useGlobalContextProvider} from '../../../context-store/context';
import {ButtonsContainer} from '../../components/admin/homeComponents/receiveBitcoin';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
// import {useGlobaleCash} from '../../../context-store/eCash';
import GetThemeColors from '../../hooks/themeColors';
import ThemeImage from '../../functions/CustomElements/themeImage';
import {initializeAddressProcess} from '../../functions/receiveBitcoin/addressGeneration';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import QrCodeWrapper from '../../functions/CustomElements/QrWrapper';
import {useNodeContext} from '../../../context-store/nodeContext';
import {useAppStatus} from '../../../context-store/appStatus';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import CustomButton from '../../functions/CustomElements/button';
import {crashlyticsLogReport} from '../../functions/crashlyticsLogs';
import {useGlobalContacts} from '../../../context-store/globalContacts';
import {useLiquidEvent} from '../../../context-store/liquidEventContext';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import {useGlobalThemeContext} from '../../../context-store/theme';
import {useToast} from '../../../context-store/toastManager';
import {useKeysContext} from '../../../context-store/keys';
import {useRootstockProvider} from '../../../context-store/rootstockSwapContext';
import {encodeLNURL} from '../../functions/lnurl/bench32Formmater';

export default function ReceivePaymentHome(props) {
  const navigate = useNavigation();
  const {fiatStats} = useNodeContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {globalContactsInformation} = useGlobalContacts();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {signer, startRootstockEventListener} = useRootstockProvider();

  const windowDimentions = useWindowDimensions().height;
  const [contentHeight, setContentHeight] = useState(0);
  // const {ecashWalletInformation} = useGlobaleCash();
  const {startLiquidEventListener} = useLiquidEvent();
  // const currentMintURL = ecashWalletInformation.mintURL;
  // const eCashBalance = ecashWalletInformation.balance;
  const initialSendAmount = props.route.params?.receiveAmount;
  const paymentDescription = props.route.params?.description;
  useHandleBackPressNew();
  const selectedRecieveOption =
    props.route.params?.selectedRecieveOption || 'Lightning';

  const [addressState, setAddressState] = useState({
    selectedRecieveOption: selectedRecieveOption,
    isReceivingSwap: false,
    generatedAddress: encodeLNURL(
      globalContactsInformation.myProfile.uniqueName,
    ),
    isGeneratingInvoice: false,
    minMaxSwapAmount: {
      min: 0,
      max: 0,
    },
    swapPegInfo: {},
    errorMessageText: {
      type: null,
      text: '',
    },
    hasGlobalError: false,
    fee: 0,
  });

  useEffect(() => {
    async function runAddressInit() {
      crashlyticsLogReport('Begining adddress initialization');
      if (
        !initialSendAmount &&
        selectedRecieveOption.toLowerCase() === 'lightning'
      ) {
        setAddressState(prev => ({
          ...prev,
          generatedAddress: encodeLNURL(
            globalContactsInformation.myProfile.uniqueName,
          ),
        }));
        return;
      }

      await initializeAddressProcess({
        userBalanceDenomination: masterInfoObject.userBalanceDenomination,
        receivingAmount: initialSendAmount,
        description: paymentDescription,
        masterInfoObject,
        minMaxSwapAmounts: minMaxLiquidSwapAmounts,
        // mintURL: currentMintURL,
        setAddressState: setAddressState,
        selectedRecieveOption: selectedRecieveOption,
        navigate,
        signer,
        // eCashBalance,
      });
      if (selectedRecieveOption === 'Liquid') {
        startLiquidEventListener();
      } else if (selectedRecieveOption === 'Rootstock') {
        startRootstockEventListener({durationMs: 1200000});
      }
    }
    runAddressInit();
  }, [initialSendAmount, paymentDescription, selectedRecieveOption]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: contentHeight > windowDimentions ? 0 : 1,
        }}
        showsVerticalScrollIndicator={false}>
        <View
          onLayout={e => {
            if (!e.nativeEvent.layout.height) return;
            setContentHeight(e.nativeEvent.layout.height);
          }}
          style={{
            width: '100%',
            alignItems: 'center',
            flexGrow: contentHeight > windowDimentions ? 0 : 1,
          }}>
          <TopBar navigate={navigate} />

          <ThemeText
            styles={{...styles.title}}
            content={selectedRecieveOption}
          />
          <QrCode
            globalContactsInformation={globalContactsInformation}
            selectedRecieveOption={selectedRecieveOption}
            navigate={navigate}
            addressState={addressState}
            initialSendAmount={initialSendAmount}
            masterInfoObject={masterInfoObject}
            fiatStats={fiatStats}
          />

          <ButtonsContainer
            generatingInvoiceQRCode={addressState.isGeneratingInvoice}
            generatedAddress={addressState.generatedAddress}
            selectedRecieveOption={selectedRecieveOption}
            initialSendAmount={initialSendAmount}
          />

          <View style={{marginBottom: 'auto'}}></View>

          <TouchableOpacity
            activeOpacity={
              selectedRecieveOption.toLowerCase() !== 'lightning' &&
              selectedRecieveOption.toLowerCase() !== 'spark'
                ? 0.2
                : 1
            }
            onPress={() => {
              if (
                selectedRecieveOption.toLowerCase() === 'lightning' ||
                selectedRecieveOption.toLowerCase() === 'spark'
              )
                return;

              let informationText = '';
              if (selectedRecieveOption.toLowerCase() === 'bitcoin') {
                informationText =
                  'On-chain payments require a network fee to be processed.\n\nIf you send money to yourself, you’ll pay the network fee twice — once to send it and once to claim it.\n\nIf someone else sends you money, you’ll only pay the network fee once to claim it.';
              } else if (selectedRecieveOption.toLowerCase() === 'liquid') {
                informationText = `Liquid payments need to be swapped into Spark.\n\nThis process includes a lockup fee of about ${displayCorrectDenomination(
                  {amount: 34, masterInfoObject, fiatStats},
                )}, a claim fee of around ${displayCorrectDenomination({
                  amount: 19,
                  masterInfoObject,
                  fiatStats,
                })}, and a 0.1% service fee from Boltz based on the amount you’re sending.`;
              }

              navigate.navigate('InformationPopup', {
                textContent: informationText,
                buttonText: 'I understand',
              });
            }}
            style={{
              alignItems: 'center',
            }}>
            <View style={styles.feeTitleContainer}>
              <ThemeText styles={styles.feeTitleText} content={'Fee'} />
              {selectedRecieveOption.toLowerCase() !== 'lightning' &&
                selectedRecieveOption.toLowerCase() !== 'spark' && (
                  <ThemeImage
                    styles={styles.AboutIcon}
                    lightModeIcon={ICONS.aboutIcon}
                    darkModeIcon={ICONS.aboutIcon}
                    lightsOutIcon={ICONS.aboutIconWhite}
                  />
                )}
            </View>
            {selectedRecieveOption.toLowerCase() !== 'lightning' &&
            selectedRecieveOption.toLowerCase() !== 'spark' ? (
              <ThemeText content="Veriable" />
            ) : (
              <FormattedSatText
                neverHideBalance={true}
                styles={{paddingBottom: 5}}
                balance={0}
              />
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </GlobalThemeView>
  );
}

function QrCode(props) {
  const {
    addressState,
    navigate,
    selectedRecieveOption,
    globalContactsInformation,
    initialSendAmount,
    masterInfoObject,
    fiatStats,
  } = props;
  const {showToast} = useToast();
  const {theme} = useGlobalThemeContext();
  const {backgroundOffset, textColor} = GetThemeColors();
  if (addressState.isGeneratingInvoice) {
    return (
      <View style={styles.qrCodeContainer}>
        <View
          style={{
            ...styles.qrCodeContainer,
            backgroundColor: backgroundOffset,
          }}>
          <FullLoadingScreen text={'Generating Invoice'} />
        </View>
        <LNURLContainer
          theme={theme}
          textColor={textColor}
          selectedRecieveOption={selectedRecieveOption}
          initialSendAmount={initialSendAmount}
          globalContactsInformation={globalContactsInformation}
          navigate={navigate}
          masterInfoObject={masterInfoObject}
          fiatStats={fiatStats}
        />
      </View>
    );
  }
  if (!addressState.generatedAddress) {
    return (
      <View style={styles.qrCodeContainer}>
        <View
          style={{
            ...styles.qrCodeContainer,
            backgroundColor: backgroundOffset,
          }}>
          <ThemeText
            styles={styles.errorText}
            content={
              addressState.errorMessageText.text || 'Unable to generate address'
            }
          />
          {addressState.errorMessageText.showButton && (
            <CustomButton
              buttonStyles={{width: '90%', marginTop: 20}}
              textContent={'Open transfer page'}
              actionFunction={() => {
                navigate.reset({
                  routes: [
                    {
                      name: 'HomeAdmin',
                      params: {screen: 'Home'},
                    },
                    {
                      name: 'SettingsHome',
                    },
                    {
                      name: 'SettingsContentHome',
                      params: {
                        for: 'Balance Info',
                      },
                    },
                  ],
                });
              }}
            />
          )}
        </View>
        <LNURLContainer
          theme={theme}
          textColor={textColor}
          selectedRecieveOption={selectedRecieveOption}
          initialSendAmount={initialSendAmount}
          globalContactsInformation={globalContactsInformation}
          navigate={navigate}
          masterInfoObject={masterInfoObject}
          fiatStats={fiatStats}
        />
      </View>
    );
  }

  return (
    <View style={styles.qrCodeContainer}>
      <TouchableOpacity
        onPress={() => {
          if (
            selectedRecieveOption?.toLowerCase() === 'lightning' &&
            !initialSendAmount
          ) {
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'chooseLNURLCopyFormat',
            });
            return;
          }
          copyToClipboard(addressState.generatedAddress, showToast);
        }}
        style={[
          styles.qrCodeContainer,
          {
            backgroundColor: backgroundOffset,
            paddingBottom: !!addressState.errorMessageText.text ? 10 : 0,
          },
        ]}>
        <QrCodeWrapper
          outerContainerStyle={{backgroundColor: 'transparent'}}
          QRData={addressState.generatedAddress}
        />

        {addressState.errorMessageText.text && (
          <ThemeText
            styles={{textAlign: 'center', width: 275, marginTop: 10}}
            content={addressState.errorMessageText.text}
          />
        )}
      </TouchableOpacity>

      <LNURLContainer
        theme={theme}
        textColor={textColor}
        selectedRecieveOption={selectedRecieveOption}
        initialSendAmount={initialSendAmount}
        globalContactsInformation={globalContactsInformation}
        navigate={navigate}
        masterInfoObject={masterInfoObject}
        fiatStats={fiatStats}
      />
    </View>
  );
}

function LNURLContainer({
  theme,
  textColor,
  selectedRecieveOption,
  initialSendAmount,
  globalContactsInformation,
  navigate,
  masterInfoObject,
  fiatStats,
}) {
  return (
    <TouchableOpacity
      activeOpacity={
        selectedRecieveOption.toLowerCase() === 'lightning' &&
        !initialSendAmount
          ? 0.2
          : 1
      }
      onPress={() => {
        if (
          !(
            selectedRecieveOption.toLowerCase() === 'lightning' &&
            !initialSendAmount
          )
        )
          return;
        navigate.navigate('CustomHalfModal', {
          wantedContent: 'editLNULROnReceive',
        });
      }}
      style={{
        width: '80%',
        paddingTop: 10,
        paddingBottom: 20,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
      }}>
      <ThemeText
        styles={{
          includeFontPadding: false,
          marginRight: 5,
          color: theme || initialSendAmount ? textColor : COLORS.primary,
        }}
        CustomNumberOfLines={1}
        content={
          selectedRecieveOption.toLowerCase() === 'lightning' &&
          !initialSendAmount
            ? `${globalContactsInformation?.myProfile?.uniqueName}@blitz-wallet.com`
            : selectedRecieveOption.toLowerCase() !== 'lightning'
            ? ' '
            : displayCorrectDenomination({
                amount: initialSendAmount,
                masterInfoObject,
                fiatStats,
              })
        }
      />
      {selectedRecieveOption.toLowerCase() === 'lightning' &&
        !initialSendAmount && (
          <ThemeImage
            styles={{height: 20, width: 20}}
            lightModeIcon={ICONS.editIcon}
            darkModeIcon={ICONS.editIconLight}
            lightsOutIcon={ICONS.editIconLight}
          />
        )}
    </TouchableOpacity>
  );
}

function TopBar(props) {
  return (
    <TouchableOpacity
      style={{marginRight: 'auto'}}
      activeOpacity={0.6}
      onPress={props.navigate.goBack}>
      <ThemeImage
        darkModeIcon={ICONS.smallArrowLeft}
        lightModeIcon={ICONS.smallArrowLeft}
        lightsOutIcon={ICONS.arrow_small_left_white}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 10,
    marginTop: 'auto',
  },
  qrCodeContainer: {
    width: 300,
    height: 'auto',
    minHeight: 300,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorText: {
    width: '90%',
    fontSize: SIZES.medium,
    textAlign: 'center',
    marginTop: 20,
  },

  secondaryButton: {
    width: 'auto',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    ...CENTER,
  },

  feeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feeTitleText: {
    includeFontPadding: false,
  },
  AboutIcon: {
    width: 15,
    height: 15,
    marginLeft: 5,
  },
});
