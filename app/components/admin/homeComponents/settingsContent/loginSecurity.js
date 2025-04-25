import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {CENTER, COLORS, LOGIN_SECUITY_MODE_KEY} from '../../../../constants';
import {useEffect, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {
  getLocalStorageItem,
  handleLogin,
  hasHardware,
  hasSavedProfile,
  setLocalStorageItem,
} from '../../../../functions';
import {ThemeText} from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import CustomToggleSwitch from '../../../../functions/CustomElements/switch';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {useTranslation} from 'react-i18next';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';

export default function LoginSecurity() {
  const [securityLoginSettings, setSecurityLoginSettings] = useState({
    isSecurityEnabled: null,
    isPinEnabled: null,
    isBiometricEnabled: null,
  });
  const navigate = useNavigation();
  const {t} = useTranslation();
  const {theme} = useGlobalThemeContext();
  const {backgroundOffset} = GetThemeColors();

  useEffect(() => {
    async function getSavedBiometricSettings() {
      const storedSettings = JSON.parse(
        await getLocalStorageItem(LOGIN_SECUITY_MODE_KEY),
      );

      setSecurityLoginSettings(storedSettings);
    }
    getSavedBiometricSettings();
  }, []);

  return (
    <View style={styles.innerContainer}>
      <View
        style={[
          styles.contentContainer,
          {
            backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
          },
        ]}>
        <View style={styles.faceIDContainer}>
          <ThemeText
            styles={{...styles.contentText}}
            content={t('settings.loginsecurity.text1')}
          />
          <CustomToggleSwitch
            stateValue={securityLoginSettings.isSecurityEnabled}
            toggleSwitchFunction={handleSwitch}
            page={'LoginSecurityMode'}
          />
        </View>
      </View>
      {securityLoginSettings.isSecurityEnabled && (
        <View style={{width: '90%', ...CENTER}}>
          <ThemeText
            styles={styles.infoHeaders}
            content={t('settings.loginsecurity.text2')}
          />
          <TouchableOpacity
            onPress={() => {
              toggleLoginSecurity('pin');
            }}
            style={styles.toggleSecurityMode}>
            <ThemeText content={t('settings.loginsecurity.text3')} />
            <CheckMarkCircle isActive={securityLoginSettings.isPinEnabled} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              toggleLoginSecurity('biometric');
            }}
            style={styles.toggleSecurityMode}>
            <ThemeText content={t('settings.loginsecurity.text4')} />
            <CheckMarkCircle
              isActive={securityLoginSettings.isBiometricEnabled}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
  async function handleSwitch() {
    setSecurityLoginSettings(prev => {
      const newStorageSettings = {
        ...prev,
        isSecurityEnabled: !prev.isSecurityEnabled,
      };
      setLocalStorageItem(
        LOGIN_SECUITY_MODE_KEY,
        JSON.stringify(newStorageSettings),
      );
      return newStorageSettings;
    });

    return;
  }
  async function toggleLoginSecurity(selectedLoginType) {
    if (selectedLoginType === 'biometric') {
      const canUseFaceID = await hasHardware();

      if (canUseFaceID) {
        const hasProfile = await hasSavedProfile();
        if (!hasProfile) {
          navigate.navigate('ErrorScreen', {
            errorMessage:
              'Device does not have a Biometric profile. Create one in settings to continue.',
          });
          return;
        } else {
          const didLogin = await handleLogin();
          if (!didLogin) {
            navigate.navigate('ErrorScreen', {
              errorMessage: 'Error logging in with Biometrics',
            });
          }
        }
      } else {
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Device does not support Biometric login',
        });
        return;
      }
    }
    setSecurityLoginSettings(prev => {
      const newStorageSettings = {
        ...prev,
        [selectedLoginType === 'pin'
          ? 'isBiometricEnabled'
          : 'isPinEnabled']: false,

        [selectedLoginType === 'pin'
          ? 'isPinEnabled'
          : 'isBiometricEnabled']: true,
      };
      setLocalStorageItem(
        LOGIN_SECUITY_MODE_KEY,
        JSON.stringify(newStorageSettings),
      );
      return newStorageSettings;
    });
  }
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    paddingTop: 20,
    ...CENTER,
  },
  contentContainer: {
    width: '100%',
    padding: 10,
    borderRadius: 8,
  },
  contentText: {
    includeFontPadding: false,
  },

  faceIDContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoHeaders: {
    width: '100%',
    marginBottom: 10,
    marginTop: 20,
  },
  toggleSecurityMode: {
    width: '100%',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 0,
  },
});
