import {StyleSheet, View, TouchableOpacity, ScrollView} from 'react-native';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {WINDOWWIDTH} from '../../../../../constants/theme';
import {CENTER} from '../../../../../constants';
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
import {useToast} from '../../../../../../context-store/toastManager';
import {useTranslation} from 'react-i18next';

export default function HistoricalVPNPurchases() {
  const {showToast} = useToast();
  const [purchaseList, setPurchaseList] = useState([]);
  const navigate = useNavigation();
  const {decodedVPNS, toggleGlobalAppDataInformation} = useGlobalAppData();
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const [isRetryingConfig, setIsRetryingConfig] = useState(false);
  const {t} = useTranslation();

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
              confirmMessage: t(
                'apps.VPN.historicalPurchasesPage.deleteVPNConfirmMessage',
              ),
              confirmFunction: () => removeVPNFromList(item.payment_hash),
            });
          }}>
          <View style={styles.infoContainer}>
            <ThemeText
              styles={{...styles.label}}
              content={t('apps.VPN.historicalPurchasesPage.country')}
            />
            <ThemeText styles={{...styles.value}} content={item.country} />
          </View>
          <View style={styles.infoContainer}>
            <ThemeText
              styles={{...styles.label}}
              content={t('apps.VPN.historicalPurchasesPage.createdAt')}
            />
            <ThemeText
              styles={{...styles.value}}
              content={new Date(item.createdTime).toLocaleString()}
            />
          </View>
          <View style={styles.infoContainer}>
            <ThemeText
              styles={{...styles.label}}
              content={t('apps.VPN.historicalPurchasesPage.duration')}
            />
            <ThemeText
              styles={{...styles.value}}
              content={
                typeof item.duration === 'string'
                  ? t(t(`constants.${item.duration?.toLowerCase()}`))
                  : t(`apps.VPN.durationSlider.${item.duration}`)
              }
            />
          </View>
          <TouchableOpacity
            onPress={() => {
              copyToClipboard(item.payment_hash, showToast);
            }}
            style={styles.infoContainer}>
            <ThemeText
              styles={{...styles.label}}
              content={t('apps.VPN.historicalPurchasesPage.paymentHash')}
            />
            <ThemeText
              CustomNumberOfLines={1}
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
          label={t('apps.VPN.historicalPurchasesPage.title')}
        />
        {isRetryingConfig ? (
          <FullLoadingScreen
            text={t('apps.VPN.historicalPurchasesPage.retryClaim')}
          />
        ) : purchaseElements.length === 0 ? (
          <View
            style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
            <ThemeText
              content={t('apps.VPN.historicalPurchasesPage.noPurchases')}
            />
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
              content={t('apps.VPN.historicalPurchasesPage.assistanceText')}
            />
            <CustomButton
              buttonStyles={{...CENTER, marginTop: 10}}
              textContent={t('apps.VPN.historicalPurchasesPage.contact')}
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
      const response = await getConfig(
        item.paymentIdentifier || item.payment_hash,
        item.country,
        item.countryCode,
      );
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
      } else {
        setIsRetryingConfig(false);
        navigate.navigate('ErrorScreen', {
          errorMessage: response.error,
        });
      }
    }
  }
  async function getConfig(payment_hash, location, countryCode) {
    try {
      let countryCodeIdentifier = '';
      if (!countryCode) {
        const countriesListResponse = await fetch(
          process.env.LNVPN_COUNTRY_LIST,
          {
            method: 'GET',
          },
        );

        const countriesList = await countriesListResponse.json();

        if (
          countriesListResponse.status !== 200 ||
          !countriesList?.data?.countries
        ) {
          return {
            didWork: false,
            error: t(
              'apps.VPN.historicalPurchasesPage.noValidCountryCodeError',
            ),
          };
        }

        const [{code}] = countriesList.data.countries.filter(item => {
          console.log(item, location);
          return isCountryMatch(item.name, location);
        });

        if (!code) {
          return {
            didWork: false,
            error: t(
              'apps.VPN.historicalPurchasesPage.noValidCountryCodeError',
            ),
          };
        }
        countryCodeIdentifier = code;
      } else {
        countryCodeIdentifier = countryCode;
      }

      const response = await fetch(process.env.LNVPN_CONFIG_DOWNLOAD, {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIdentifier: payment_hash,
          paymentMethod: 'lightning',
          country: countryCodeIdentifier,
          partnerCode: 'BlitzWallet',
        }),
      });
      const contentType = response.headers.get('content-type');

      let dataResponse;
      if (contentType && contentType.includes('application/json')) {
        dataResponse = await response.json();
      } else {
        dataResponse = await response.text();
      }

      if (dataResponse?.error || response.status !== 200) {
        return {
          didWork: false,
          error:
            dataResponse?.error ||
            t('apps.VPN.historicalPurchasesPage.claimConfigError'),
        };
      }

      const configFile =
        typeof dataResponse === 'string'
          ? dataResponse
          : dataResponse.data.config;
      return {didWork: true, config: configFile};
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
