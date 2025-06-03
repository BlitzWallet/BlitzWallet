import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import {useMemo, useState} from 'react';
import {CENTER, CONTENT_KEYBOARD_OFFSET} from '../../../../../constants';
import VPNDurationSlider from './components/durationSlider';
import CustomButton from '../../../../../functions/CustomElements/button';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {useNavigation} from '@react-navigation/native';
import {parseInput} from '@breeztech/react-native-breez-sdk';
import {SATSPERBITCOIN} from '../../../../../constants/math';
import GeneratedFile from './pages/generatedFile';
import {encriptMessage} from '../../../../../functions/messaging/encodingAndDecodingMessages';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import GetThemeColors from '../../../../../hooks/themeColors';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useKeysContext} from '../../../../../../context-store/keys';
import sendStorePayment from '../../../../../functions/apps/payments';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import useAppInsets from '../../../../../hooks/useAppInsets';

export default function VPNPlanPage({countryList}) {
  const [searchInput, setSearchInput] = useState('');
  const {contactsPrivateKey, publicKey, accountMnemoinc} = useKeysContext();
  const {nodeInformation, liquidNodeInformation} = useNodeContext();
  const {decodedVPNS, toggleGlobalAppDataInformation} = useGlobalAppData();
  const {masterInfoObject} = useGlobalContextProvider();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const [selectedDuration, setSelectedDuration] = useState('week');
  const [isPaying, setIsPaying] = useState(false);
  const [generatedFile, setGeneratedFile] = useState(null);
  const navigate = useNavigation();
  const {textColor} = GetThemeColors();
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const {bottomPadding} = useAppInsets();

  const countryElements = useMemo(() => {
    return [...countryList]
      .filter(item =>
        item.country
          .slice(5)
          .toLowerCase()
          .startsWith(searchInput.toLocaleLowerCase()),
      )
      .map(item => {
        if (item.cc === 2) return <View key={item.country} />;
        return (
          <TouchableOpacity
            onPress={() => {
              setSearchInput(item.country);
            }}
            style={styles.countryElementPadding}
            key={item.country}>
            <ThemeText styles={{textAlign: 'center'}} content={item.country} />
          </TouchableOpacity>
        );
      });
  }, [searchInput, countryList]);

  return (
    <View
      style={{
        flex: 1,
        paddingBottom: isKeyboardActive
          ? CONTENT_KEYBOARD_OFFSET
          : bottomPadding,
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
              text={loadingMessage || 'Retriving invoice'}
            />
          )}
        </>
      ) : (
        <>
          <VPNDurationSlider
            setSelectedDuration={setSelectedDuration}
            selectedDuration={selectedDuration}
          />
          <View style={{flex: 1, marginTop: 10}}>
            <CustomSearchInput
              inputText={searchInput}
              setInputText={setSearchInput}
              placeholderText={'Search for a country'}
              onBlurFunction={() => setIsKeyboardActive(false)}
              onFocusFunction={() => setIsKeyboardActive(true)}
            />
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{paddingTop: 10}}>
              {countryElements}
            </ScrollView>

            {!isKeyboardActive && (
              <CustomButton
                buttonStyles={{marginTop: 'auto', width: 'auto', ...CENTER}}
                textContent={'Create VPN'}
                actionFunction={() => {
                  const didAddLocation = countryList.filter(item => {
                    return item.country === searchInput;
                  });

                  if (didAddLocation.length === 0) {
                    navigate.navigate('ErrorScreen', {
                      errorMessage: `Please select a country for the VPN to be located in`,
                    });
                    setIsPaying(false);
                    return;
                  }

                  const [{cc, country}] = didAddLocation;

                  const cost = Math.round(
                    (SATSPERBITCOIN / nodeInformation.fiatStats.value) *
                      (selectedDuration === 'week'
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
                }}
              />
            )}
          </View>
        </>
      )}
    </View>
  );

  async function createVPN() {
    setIsPaying(true);
    let savedVPNConfigs = JSON.parse(JSON.stringify(decodedVPNS));

    const [{cc, country}] = countryList.filter(item => {
      return item.country === searchInput;
    });

    console.log(
      selectedDuration,
      selectedDuration === 'week'
        ? '1'
        : selectedDuration === 'month'
        ? '4'
        : '9',
    );
    try {
      const response = await fetch('https://lnvpn.net/api/v1/getInvoice', {
        method: 'POST',
        body: new URLSearchParams({
          duration:
            selectedDuration === 'week'
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
      const invoice = await response.json();
      console.log(invoice, 'GET INVOICE API RESPONSE');

      if (invoice.payment_hash && invoice.payment_request) {
        savedVPNConfigs.push({
          payment_hash: invoice.payment_hash,
          payment_request: invoice.payment_request,
          createdTime: new Date(),
          duration: selectedDuration,
          country: country,
        });
        setLoadingMessage('Paying invoice');
        saveVPNConfigsToDB(savedVPNConfigs);
        const parsedInput = await parseInput(invoice.payment_request);
        const sendingAmountSat = parsedInput.invoice.amountMsat / 1000;
        const paymentResponse = await sendStorePayment({
          liquidNodeInformation,
          nodeInformation,
          invoice: invoice.payment_request,
          minMaxLiquidSwapAmounts,
          sendingAmountSats: sendingAmountSat,
          masterInfoObject: masterInfoObject,
          accountMnemoinc,
        });

        if (!paymentResponse.didWork) {
          setIsPaying(false);
          navigate.navigate('ErrorScreen', {
            errorMessage: paymentResponse.reason || 'Error paying invoice.',
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
          errorMessage: 'Error creating invoice',
        });
        setIsPaying(false);
      }
    } catch (err) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Error paying invoice',
      });
      setIsPaying(false);
    }
  }

  async function getVPNConfig({paymentHash, location, savedVPNConfigs}) {
    let didSettleInvoice = false;
    let runCount = 0;

    while (!didSettleInvoice && runCount < 10) {
      try {
        setLoadingMessage(`Running ${runCount} for 10 tries`);

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
        errorMessage: 'Not able to get config file',
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
});
