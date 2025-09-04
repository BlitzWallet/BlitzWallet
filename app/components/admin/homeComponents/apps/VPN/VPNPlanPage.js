import {FlatList, StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import {useCallback, useState} from 'react';
import {COLORS, SCREEN_DIMENSIONS, SIZES} from '../../../../../constants';
import VPNDurationSlider from './components/durationSlider';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {useNavigation} from '@react-navigation/native';
import {SATSPERBITCOIN} from '../../../../../constants/math';
import GeneratedFile from './pages/generatedFile';
import {encriptMessage} from '../../../../../functions/messaging/encodingAndDecodingMessages';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useKeysContext} from '../../../../../../context-store/keys';
import sendStorePayment from '../../../../../functions/apps/payments';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {parse} from '@breeztech/react-native-breez-sdk-liquid';
import {sparkPaymenWrapper} from '../../../../../functions/spark/payments';
import {useSparkWallet} from '../../../../../../context-store/sparkContext';
import {useGlobalInsets} from '../../../../../../context-store/insetsProvider';
import {useActiveCustodyAccount} from '../../../../../../context-store/activeAccount';
import {useTranslation} from 'react-i18next';
import CountryFlag from 'react-native-country-flag';

export default function VPNPlanPage({countryList}) {
  const {theme, darkModeType} = useGlobalContextProvider();
  const [searchInput, setSearchInput] = useState('');
  const {currentWalletMnemoinc} = useActiveCustodyAccount();
  const {sparkInformation} = useSparkWallet();
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {fiatStats} = useNodeContext();
  const {decodedVPNS, toggleGlobalAppDataInformation} = useGlobalAppData();
  const {masterInfoObject} = useGlobalContextProvider();
  const [selectedDuration, setSelectedDuration] = useState('week');
  const [isPaying, setIsPaying] = useState(false);
  const [generatedFile, setGeneratedFile] = useState(null);
  const navigate = useNavigation();
  const {textColor} = GetThemeColors();
  const [loadingMessage, setLoadingMessage] = useState('');
  const {bottomPadding} = useGlobalInsets();
  const {t} = useTranslation();

  const flatListElement = useCallback(
    ({item}) => {
      return (
        <TouchableOpacity
          onPress={() => {
            if (item.country === searchInput) {
              setSearchInput('');
              return;
            }
            setSearchInput(item.country);
          }}
          style={[
            styles.countryItem,
            {
              borderWidth: 2,
              borderColor:
                searchInput === item.country
                  ? theme && darkModeType
                    ? COLORS.darkModeText
                    : COLORS.primary
                  : 'transparent',
            },
          ]}
          key={item.country}>
          <CountryFlag
            style={{marginBottom: 5, borderRadius: 8}}
            size={50}
            isoCode={item.isoCode}
          />
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.countryText}
            content={item.country
              .replace(/[\u{1F1E6}-\u{1F1FF}]{2}\s*/gu, '')
              .replace(/-/g, ' ')}
          />
        </TouchableOpacity>
      );
    },
    [searchInput],
  );

  const handleSubmit = useCallback(() => {
    const didAddLocation = countryList.filter(item => {
      return item.country === searchInput;
    });

    if (didAddLocation.length === 0) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('apps.VPN.VPNPlanPage.noLocationError'),
      });
      setIsPaying(false);
      return;
    }

    const [{cc, country}] = didAddLocation;

    const cost = Math.round(
      (SATSPERBITCOIN / fiatStats.value) *
        (selectedDuration === 'hour'
          ? 0.1
          : selectedDuration === 'day'
          ? 0.5
          : selectedDuration === 'week'
          ? 1.5
          : selectedDuration === 'month'
          ? 4
          : 9),
    );

    navigate.navigate('CustomHalfModal', {
      wantedContent: 'confirmVPN',
      country: country,
      duration: selectedDuration,
      createVPN: createVPN,
      price: cost,
      sliderHight: 0.5,
    });
  }, [countryList, navigate, selectedDuration, createVPN]);

  return (
    <View
      style={{
        flex: 1,
        paddingBottom: bottomPadding,
      }}>
      {isPaying ? (
        <>
          {generatedFile ? (
            <GeneratedFile generatedFile={generatedFile} />
          ) : (
            <FullLoadingScreen
              textStyles={{
                color: textColor,
              }}
              text={
                loadingMessage || t('apps.VPN.VPNPlanPage.backupLoadingMessage')
              }
            />
          )}
        </>
      ) : (
        <>
          <VPNDurationSlider
            setSelectedDuration={setSelectedDuration}
            selectedDuration={selectedDuration}
          />

          <FlatList
            numColumns={3}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={3}
            style={styles.flatListOuterContianer}
            contentContainerStyle={styles.flatListContainer}
            columnWrapperStyle={styles.row}
            data={countryList}
            renderItem={flatListElement}
            keyExtractor={item => item.isoCode}
          />

          <CustomButton
            buttonStyles={styles.buttonContainer}
            textContent={t('apps.VPN.VPNPlanPage.createVPNBTN')}
            actionFunction={handleSubmit}
          />
        </>
      )}
    </View>
  );

  async function createVPN(invoiceInformation) {
    setIsPaying(true);
    let savedVPNConfigs = JSON.parse(JSON.stringify(decodedVPNS));

    const [{cc, country}] = countryList.filter(item => {
      return item.country === searchInput;
    });

    try {
      let invoice = '';

      if (
        invoiceInformation.payment_request &&
        invoiceInformation.payment_hash
      ) {
        invoice = invoiceInformation;
      } else {
        const response = await fetch('https://lnvpn.net/api/v1/getInvoice', {
          method: 'POST',
          body: new URLSearchParams({
            duration:
              selectedDuration === 'hour'
                ? 0.1
                : selectedDuration === 'day'
                ? 0.5
                : selectedDuration === 'week'
                ? 1.5
                : selectedDuration === 'month'
                ? 4
                : 9,
          }).toString(),
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        const responseData = await response.json();
        const cost = Math.round(
          (SATSPERBITCOIN / fiatStats.value) *
            (selectedDuration === 'week'
              ? 1.5
              : selectedDuration === 'month'
              ? 4
              : 9),
        );

        const fee = await sparkPaymenWrapper({
          getFee: true,
          address: responseData.payment_request,
          paymentType: 'lightning',
          amountSats: cost,
          masterInfoObject,
          sparkInformation,
          userBalance: sparkInformation.balance,
          mnemonic: currentWalletMnemoinc,
        });
        if (!fee.didWork) throw new Error(fee.error);
        invoice = {
          ...responseData,
          supportFee: fee.supportFee,
          fee: fee.fee,
        };
      }

      if (invoice.payment_hash && invoice.payment_request) {
        savedVPNConfigs.push({
          payment_hash: invoice.payment_hash,
          payment_request: invoice.payment_request,
          createdTime: new Date(),
          duration: selectedDuration,
          country: country,
        });
        setLoadingMessage(
          t('apps.VPN.VPNPlanPage.payingInvoiceLoadingMessage'),
        );
        saveVPNConfigsToDB(savedVPNConfigs);
        const parsedInput = await parse(invoice.payment_request);
        const sendingAmountSat = parsedInput.invoice.amountMsat / 1000;
        const paymentResponse = await sendStorePayment({
          invoice: invoice.payment_request,
          masterInfoObject,
          sendingAmountSats: sendingAmountSat,
          paymentType: 'lightning',
          userBalance: sparkInformation.balance,
          fee: invoice.fee + invoice.supportFee,
          sparkInformation,
          description: t('apps.VPN.VPNPlanPage.paymentMemo'),
          currentWalletMnemoinc: currentWalletMnemoinc,
        });

        if (!paymentResponse.didWork) {
          setIsPaying(false);
          navigate.navigate('ErrorScreen', {
            errorMessage:
              paymentResponse.reason ||
              t('apps.VPN.VPNPlanPage.backupPaymentError'),
          });
          return;
        }
        getVPNConfig({
          paymentHash: invoice.payment_hash,
          location: cc,
          savedVPNConfigs,
        });
      } else {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('apps.VPN.VPNPlanPage.createInvoiceError'),
        });
        setIsPaying(false);
      }
    } catch (err) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('apps.VPN.VPNPlanPage.payingInvoiveError'),
      });
      setIsPaying(false);
    }
  }

  async function getVPNConfig({paymentHash, location, savedVPNConfigs}) {
    let didSettleInvoice = false;
    let runCount = 0;

    while (!didSettleInvoice && runCount < 10) {
      try {
        setLoadingMessage(
          t('apps.VPN.VPNPlanPage.runningTries', {
            runCount: runCount,
            maxTries: 10,
          }),
        );

        runCount += 1;
        const response = await fetch(
          'https://lnvpn.net/api/v1/getTunnelConfig',
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              paymentHash,
              location: `${location}`,
              partnerCode: 'BlitzWallet',
            }).toString(),
          },
        );

        const data = await response.json();

        if (data.WireguardConfig) {
          didSettleInvoice = true;
          setGeneratedFile(data.WireguardConfig);

          const updatedList = savedVPNConfigs.map(item => {
            if (item.payment_hash === paymentHash) {
              return {...item, config: data.WireguardConfig};
            } else return item;
          });
          saveVPNConfigsToDB(updatedList);
        } else {
          console.log('Wating for confirmation...');
          await new Promise(resolve => setTimeout(resolve, 12000));
        }
      } catch (err) {
        console.log(err);
        console.log('Wating for confirmation...');
        await new Promise(resolve => setTimeout(resolve, 12000));
      }
    }
    if (!didSettleInvoice) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('apps.VPN.VPNPlanPage.configError'),
      });
      setIsPaying(false);
      return;
    }
  }

  async function saveVPNConfigsToDB(configList) {
    const em = encriptMessage(
      contactsPrivateKey,
      publicKey,
      JSON.stringify(configList),
    );

    toggleGlobalAppDataInformation({VPNplans: em}, true);
  }
}

const styles = StyleSheet.create({
  countryElementPadding: {paddingVertical: 10},
  flatListOuterContianer: {
    marginTop: 10,
  },
  flatListContainer: {
    width: '100%',
    paddingBottom: 20,
    gap: 15,
    alignSelf: 'center',
    paddingTop: 20,
  },
  row: {
    gap: 15,
  },
  countryItem: {
    flex: 1,
    maxWidth: SCREEN_DIMENSIONS.width * 0.3333 - 15,
    alignItems: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
  },
  countryText: {
    opacity: 0.8,
    fontSize: SIZES.small,
    textAlign: 'center',
    flexShrink: 1,
  },
  buttonContainer: {
    alignSelf: 'center',
    marginTop: 10,
  },
});
