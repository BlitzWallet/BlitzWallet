import {FlatList, StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import {useCallback, useState} from 'react';
import {COLORS, SCREEN_DIMENSIONS, SIZES} from '../../../../../constants';
import VPNDurationSlider from './components/durationSlider';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {useNavigation} from '@react-navigation/native';
import GeneratedFile from './pages/generatedFile';
import {encriptMessage} from '../../../../../functions/messaging/encodingAndDecodingMessages';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useKeysContext} from '../../../../../../context-store/keys';
import sendStorePayment from '../../../../../functions/apps/payments';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useSparkWallet} from '../../../../../../context-store/sparkContext';
import {useGlobalInsets} from '../../../../../../context-store/insetsProvider';
import {useActiveCustodyAccount} from '../../../../../../context-store/activeAccount';
import {useTranslation} from 'react-i18next';
import CountryFlag from 'react-native-country-flag';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {decode} from 'bolt11';

export default function VPNPlanPage({vpnInformation}) {
  const countryList = vpnInformation.countries;
  const {theme, darkModeType} = useGlobalThemeContext();
  const [searchInput, setSearchInput] = useState('');
  const {currentWalletMnemoinc} = useActiveCustodyAccount();
  const {sparkInformation} = useSparkWallet();
  const {contactsPrivateKey, publicKey} = useKeysContext();
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
            if (item.name === searchInput) {
              setSearchInput('');
              return;
            }
            setSearchInput(item.name);
          }}
          style={[
            styles.countryItem,
            {
              borderWidth: 2,
              borderColor:
                searchInput === item.name
                  ? theme && darkModeType
                    ? COLORS.darkModeText
                    : COLORS.primary
                  : 'transparent',
            },
          ]}
          key={item.name}>
          <CountryFlag
            style={{marginBottom: 5, borderRadius: 8}}
            size={50}
            isoCode={item.isoCode}
          />
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.countryText}
            content={item.name
              .replace(/[\u{1F1E6}-\u{1F1FF}]{2}\s*/gu, '')
              .replace(/-/g, ' ')}
          />
        </TouchableOpacity>
      );
    },
    [searchInput, theme, darkModeType],
  );

  const handleSubmit = useCallback(() => {
    const didAddLocation = countryList.filter(item => {
      return item.name === searchInput;
    });

    if (didAddLocation.length === 0) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('apps.VPN.VPNPlanPage.noLocationError'),
      });
      setIsPaying(false);
      return;
    }

    const [{name}] = didAddLocation;

    navigate.navigate('CustomHalfModal', {
      wantedContent: 'confirmVPN',
      country: name,
      duration: selectedDuration,
      createVPN: createVPN,
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
            vpnInformation={vpnInformation}
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
            showsVerticalScrollIndicator={false}
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

    const [{code, name, isoCode}] = countryList.filter(item => {
      return item.name === searchInput;
    });

    try {
      let invoice = invoiceInformation;

      if (
        invoice.payment_hash &&
        invoice.payment_request &&
        invoice.paymentIdentifier
      ) {
        setLoadingMessage(
          t('apps.VPN.VPNPlanPage.payingInvoiceLoadingMessage'),
        );
        savedVPNConfigs.push({
          payment_hash: invoice.payment_hash,
          payment_request: invoice.payment_request,
          paymentIdentifier: invoice.paymentIdentifier,
          createdTime: new Date(),
          duration: selectedDuration,
          country: name,
          countryCode: code,
          isoCode: isoCode,
        });
        saveVPNConfigsToDB(savedVPNConfigs);
        const parsedInvoice = decode(invoice.payment_request);

        const sendingAmountSat = parsedInvoice.satoshis;

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
          paymentIdentifier: invoice.paymentIdentifier,
          location: code,
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

  async function getVPNConfig({
    paymentHash,
    paymentIdentifier,
    location,
    savedVPNConfigs,
  }) {
    let didSettleInvoice = false;
    let runCount = 1;

    while (!didSettleInvoice && runCount < 10) {
      try {
        setLoadingMessage(
          t('apps.VPN.VPNPlanPage.runningTries', {
            runCount: runCount,
            maxTries: 10,
          }),
        );

        runCount += 1;
        const apiResponse = await fetch(process.env.LNVPN_CONFIG_DOWNLOAD, {
          method: 'POST',
          headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentIdentifier: paymentIdentifier,
            paymentMethod: 'lightning',
            country: location,
            partnerCode: 'BlitzWallet',
          }),
        });

        const contentType = apiResponse.headers.get('content-type');

        let dataResponse;
        if (contentType && contentType.includes('application/json')) {
          dataResponse = await apiResponse.json();
        } else {
          dataResponse = await apiResponse.text();
        }

        if (dataResponse?.error || apiResponse.status !== 200)
          throw new Error('Error with backend', dataResponse?.error);

        didSettleInvoice = true;
        const configFile =
          typeof dataResponse === 'string'
            ? dataResponse
            : dataResponse.data.config; // make sure to match with actual api

        const updatedList = savedVPNConfigs.map(item => {
          if (item.payment_hash === paymentHash) {
            return {...item, config: configFile};
          } else return item;
        });
        await saveVPNConfigsToDB(updatedList);
        setGeneratedFile(configFile);
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
    padding: 8,
    borderRadius: 12,
  },
  countryText: {
    opacity: 0.8,
    fontSize: SIZES.small,
    textAlign: 'center',
    includeFontPadding: false,
    flexShrink: 1,
  },
  buttonContainer: {
    alignSelf: 'center',
    marginTop: 10,
  },
});
