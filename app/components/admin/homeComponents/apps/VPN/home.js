import {
  Keyboard,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CustomKeyboardAvoidingView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import {
  COLORS,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import {ICONS} from '../../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {useEffect, useState} from 'react';
import CustomButton from '../../../../../functions/CustomElements/button';
import VPNPlanPage from './VPNPlanPage';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import openWebBrowser from '../../../../../functions/openWebBrowser';
import {KEYBOARDTIMEOUT} from '../../../../../constants/styles';
import {useTranslation} from 'react-i18next';

export default function VPNHome() {
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const [selectedPage, setSelectedPage] = useState(null);
  const [countryList, setCountriesList] = useState([]);
  const {t} = useTranslation();
  useEffect(() => {
    async function getAvailableCountries() {
      try {
        const response = await fetch('https://lnvpn.net/api/v1/countryList', {
          method: 'GET',
        });
        const data = await response.json();

        setCountriesList(data);
      } catch (err) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('apps.VPN.home.apiConnectionError'),
          customNavigator: () => {
            navigate.popTo('HomeAdmin');
          },
        });
        console.log(err);
      }
    }
    getAvailableCountries();
  }, []);

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      useStandardWidth={true}>
      <CustomSettingsTopBar
        customBackFunction={() => {
          if (selectedPage === null) navigate.goBack();
          else {
            Keyboard.dismiss();
            setTimeout(
              () => {
                setSelectedPage(null);
              },
              Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0,
            );
          }
        }}
        label={selectedPage ? t('apps.VPN.home.selectPlan') : ''}
        showLeftImage={!selectedPage}
        leftImageBlue={ICONS.receiptIcon}
        LeftImageDarkMode={ICONS.receiptWhite}
        leftImageFunction={() => {
          navigate.navigate('HistoricalVPNPurchases');
        }}
        containerStyles={{height: 30}}
      />
      <View style={styles.container}>
        {!selectedPage ? (
          <View style={styles.homepage}>
            <ThemeText
              styles={styles.header}
              content={t('apps.VPN.home.title')}
            />
            <TouchableOpacity
              onPress={async () => {
                await openWebBrowser({
                  navigate: navigate,
                  link:
                    Platform.OS === 'ios'
                      ? 'https://apps.apple.com/us/app/wireguard/id1441195209'
                      : 'https://play.google.com/store/apps/details?id=com.wireguard.android',
                });
              }}>
              <ThemeText
                styles={{
                  color:
                    theme && darkModeType
                      ? COLORS.darkModeText
                      : COLORS.primary,
                  textAlign: 'center',
                  marginTop: 10,
                }}
                content={t('apps.VPN.home.downloadApp')}
              />
            </TouchableOpacity>

            <CustomButton
              buttonStyles={{width: '80%', marginTop: 50}}
              actionFunction={() => {
                if (!countryList.length) return;
                setSelectedPage('Select Plan');
              }}
              textContent={t('constants.continue')}
              useLoading={!countryList.length}
            />
          </View>
        ) : (
          <VPNPlanPage countryList={countryList} />
        )}
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  homepage: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  header: {textAlign: 'center', fontSize: SIZES.large},
});
