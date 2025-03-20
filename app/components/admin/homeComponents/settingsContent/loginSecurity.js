import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {
  CENTER,
  COLORS,
  LOGIN_SECUITY_MODE_KEY,
  SIZES,
} from '../../../../constants';
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
import Icon from '../../../../functions/CustomElements/Icon';
import {useGlobalThemeContext} from '../../../../../context-store/theme';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';

export default function LoginSecurity() {
  const [securityLoginSettings, setSecurityLoginSettings] = useState({
    isSecurityEnabled: null,
    isPinEnabled: null,
    isBiometricEnabled: null,
  });
  const navigate = useNavigation();
  const {theme, darkModeType} = useGlobalThemeContext();
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
            content={'Enable Login Security'}
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
            styles={{...styles.infoHeaders}}
            content={'Security Type'}
          />
          <TouchableOpacity
            onPress={() => {
              toggleLoginSecurity('pin');
            }}
            style={[
              styles.toggleSecurityMode,
              {
                minHeight: 0,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
                paddingHorizontal: 0,
              },
            ]}>
            <ThemeText content={`Pin`} />
            <View
              style={{
                height: 30,
                width: 30,
                backgroundColor: securityLoginSettings.isPinEnabled
                  ? theme
                    ? backgroundOffset
                    : COLORS.primary
                  : 'transparent',
                borderWidth: securityLoginSettings.isPinEnabled ? 0 : 2,
                borderColor: theme ? backgroundOffset : COLORS.white,
                borderRadius: 15,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {securityLoginSettings.isPinEnabled && (
                <Icon
                  width={15}
                  height={15}
                  color={COLORS.darkModeText}
                  name={'expandedTxCheck'}
                />
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              toggleLoginSecurity('biometric');
            }}
            style={[
              styles.toggleSecurityMode,
              {
                // backgroundColor: theme
                //   ? COLORS.darkModeBackgroundOffset
                //   : COLORS.darkModeText,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
                paddingHorizontal: 0,
                minHeight: 0,
              },
            ]}>
            <ThemeText content={`Biometric`} />
            <View
              style={{
                height: 30,
                width: 30,
                backgroundColor: securityLoginSettings.isBiometricEnabled
                  ? theme
                    ? backgroundOffset
                    : COLORS.primary
                  : 'transparent',
                borderColor: theme ? backgroundOffset : COLORS.white,
                borderWidth: securityLoginSettings.isBiometricEnabled ? 0 : 2,
                borderRadius: 15,
                alignItems: 'center',

                justifyContent: 'center',
              }}>
              {securityLoginSettings.isBiometricEnabled && (
                <Icon
                  width={15}
                  height={15}
                  color={COLORS.darkModeText}
                  name={'expandedTxCheck'}
                />
              )}
            </View>
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
    minHeight: 60,
    width: '100%',
    paddingHorizontal: 10,
    borderRadius: 8,
  },
});
