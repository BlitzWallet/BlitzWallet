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
import {COLORS, SIZES} from '../../../../../constants/theme';
import {CENTER, ICONS} from '../../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {useEffect, useState} from 'react';
import CustomButton from '../../../../../functions/CustomElements/button';
import VPNPlanPage from './VPNPlanPage';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import openWebBrowser from '../../../../../functions/openWebBrowser';
import {KEYBOARDTIMEOUT} from '../../../../../constants/styles';

export default function VPNHome() {
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
  const [selectedPage, setSelectedPage] = useState(null);
  const [countryList, setCountriesList] = useState([]);
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
          errorMessage: 'Unable to get available countries',
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
      <View style={{flex: 1}}>
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
          label={selectedPage || ''}
          showLeftImage={!selectedPage}
          leftImageBlue={ICONS.receiptIcon}
          LeftImageDarkMode={ICONS.receiptWhite}
          leftImageFunction={() => {
            navigate.navigate('HistoricalVPNPurchases');
          }}
          containerStyles={{height: 30}}
        />
        {!selectedPage ? (
          <View style={styles.homepage}>
            <ThemeText
              styles={{textAlign: 'center', fontSize: SIZES.large}}
              content={
                'To use this VPN please download the Wireguard VPN client app'
              }
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
                  textAlign: 'center',
                  marginTop: 15,
                  color:
                    theme && darkModeType
                      ? COLORS.darkModeText
                      : COLORS.primary,
                }}
                content={'Download Here'}
              />
            </TouchableOpacity>

            <CustomButton
              buttonStyles={{width: '80%', marginTop: 50}}
              actionFunction={() => {
                if (!countryList.length) return;
                setSelectedPage('Select Plan');
              }}
              textContent={'Continue'}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
