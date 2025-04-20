import {StyleSheet, View, TouchableOpacity, ScrollView} from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {SIZES, WINDOWWIDTH} from '../../../../../constants/theme';
import {CENTER, ICONS} from '../../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {useEffect, useState} from 'react';
import {copyToClipboard, getLocalStorageItem} from '../../../../../functions';
import CustomButton from '../../../../../functions/CustomElements/button';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import {encriptMessage} from '../../../../../functions/messaging/encodingAndDecodingMessages';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {useKeysContext} from '../../../../../../context-store/keys';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import openWebBrowser from '../../../../../functions/openWebBrowser';

export default function HistoricalVPNPurchases() {
  const [purchaseList, setPurchaseList] = useState([]);
  const navigate = useNavigation();
  const {decodedVPNS, toggleGlobalAppDataInformation} = useGlobalAppData();
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const [isRetryingConfig, setIsRetryingConfig] = useState(false);

  useEffect(() => {
    async function getSavedPurchases() {
      const savedVPNConfigs = JSON.parse(JSON.stringify(decodedVPNS));
      const savedRequests =
        JSON.parse(await getLocalStorageItem('savedVPNIds')) || [];
      setPurchaseList([...savedRequests, ...savedVPNConfigs]);
    }
    getSavedPurchases();
  }, [decodedVPNS]);

  const purchaseElements = purchaseList
    .map((item, index) => {
      if (!item) return false;
      return (
        <TouchableOpacity
          key={item.createdTime}
          style={styles.container}
          onPress={() => handleConfigClick(item)}
          onLongPress={() => {
            navigate.navigate('ConfirmActionPage', {
              confirmMessage: 'Are you sure you want to remove this VPN.',
              confirmFunction: () => removeVPNFromList(item.payment_hash),
            });
          }}>
          <View style={styles.infoContainer}>
            <ThemeText styles={{...styles.label}} content={'Country:'} />
            <ThemeText styles={{...styles.value}} content={item.country} />
          </View>
          <View style={styles.infoContainer}>
            <ThemeText styles={{...styles.label}} content={'Created At:'} />
            <ThemeText
              styles={{...styles.value}}
              content={new Date(item.createdTime).toLocaleString()}
            />
          </View>
          <View style={styles.infoContainer}>
            <ThemeText styles={{...styles.label}} content={'Duration:'} />
            <ThemeText styles={{...styles.value}} content={item.duration} />
          </View>
          <TouchableOpacity
            onPress={() => {
              copyToClipboard(item.payment_hash, navigate);
            }}
            style={styles.infoContainer}>
            <ThemeText styles={{...styles.label}} content={'Payment Hash:'} />
            <ThemeText
              CustomNumberOfLines={2}
              styles={{...styles.value}}
              content={`${item.payment_hash}`}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    })
    .filter(Boolean);
  return (
    <GlobalThemeView>
      <View style={styles.globalContainer}>
        <CustomSettingsTopBar
          containerStyles={{
            marginBottom: 0,
          }}
          label={'Purchases'}
        />
        {isRetryingConfig ? (
          <FullLoadingScreen text={'Trying to create file'} />
        ) : purchaseElements.length === 0 ? (
          <View
            style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
            <ThemeText content={'You have no VPN configuations'} />
          </View>
        ) : (
          <>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{paddingVertical: 30}}
              style={{width: '90%', ...CENTER}}>
              {purchaseElements}
            </ScrollView>
            <ThemeText
              styles={{textAlign: 'center', paddingTop: 5}}
              content={'For assistance, reach out to LNVPN'}
            />
            <CustomButton
              buttonStyles={{...CENTER, marginTop: 10}}
              textContent={'Contact'}
              actionFunction={async () => {
                await openWebBrowser({
                  navigate: navigate,
                  link: 'https://t.me/+x_j8zikjnqhiODIy',
                });
              }}
            />
          </>
        )}
      </View>
    </GlobalThemeView>
  );

  async function handleConfigClick(item) {
    if (item.config)
      navigate.navigate('GeneratedVPNFile', {
        generatedFile: item.config,
      });
    else {
      setIsRetryingConfig(true);
      (async () => {
        const response = await getConfig(item.payment_hash, item.country);
        if (response.didWork) {
          const newCardsList = decodedVPNS
            ?.map(vpn => {
              if (vpn.payment_hash === item.payment_hash) {
                return {...vpn, config: response.config};
              } else return vpn;
            })
            .filter(Boolean);

          const em = encriptMessage(
            contactsPrivateKey,
            publicKey,
            JSON.stringify(newCardsList),
          );
          toggleGlobalAppDataInformation({VPNplans: em}, true);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              navigate.navigate('GeneratedVPNFile', {
                generatedFile: response.config,
              });
            });
          });
          setIsRetryingConfig(false);
          return;
        }
        setIsRetryingConfig(false);
        navigate.navigate('ErrorScreen', {
          errorMessage: response.error,
        });
      })();
    }
  }
  async function getConfig(paymentHash, location) {
    try {
      const countriesListResponse = await fetch(
        'https://lnvpn.net/api/v1/countryList',
        {
          method: 'GET',
        },
      );

      const countriesList = await countriesListResponse.json();
      console.log(countriesList);
      const [{cc}] = countriesList.filter(item => {
        console.log(item.country, location);
        return isCountryMatch(item.country, location);
      });
      console.log(cc);
      if (!cc) {
        return {didWork: false, error: 'Not able to get valid country code'};
      }

      const response = await fetch('https://lnvpn.net/api/v1/getTunnelConfig', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          paymentHash,
          location: `${cc}`,
          partnerCode: 'BlitzWallet',
        }).toString(),
      });

      const data = await response.json();
      if (!data.WireguardConfig) {
        return {didWork: false, error: data?.error || 'Not able to get config'};
      }
      return {didWork: true, config: data.WireguardConfig};
    } catch (err) {
      console.log(err);
      return {didWork: false, error: String(err)};
    }
  }
  function removeVPNFromList(selctedVPN) {
    const newCardsList = decodedVPNS?.filter(
      vpn => vpn.payment_hash !== selctedVPN,
    );

    const em = encriptMessage(
      contactsPrivateKey,
      publicKey,
      JSON.stringify(newCardsList),
    );
    toggleGlobalAppDataInformation({VPNplans: em}, true);
  }
}
function isCountryMatch(selected, text) {
  // Normalize by removing flags, making lowercase, and replacing hyphens with spaces
  const normalize = str =>
    str
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Remove emoji flags
      .toLowerCase()
      .replace(/[-\s]+/g, ' '); // Normalize spaces and hyphens

  return normalize(text).includes(normalize(selected));
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
    width: WINDOWWIDTH,
    ...CENTER,
  },
  container: {
    marginVertical: 10,
  },
  infoContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  label: {
    fontWeight: 'bold',
    marginRight: 10,
  },
  value: {
    flex: 1,
    flexWrap: 'wrap',
  },
});
