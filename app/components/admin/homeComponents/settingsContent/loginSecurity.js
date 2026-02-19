import { StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CENTER,
  COLORS,
  LOGIN_SECUITY_MODE_KEY,
  RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY,
} from '../../../../constants';
import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  getLocalStorageItem,
  hasHardware,
  hasSavedProfile,
  setLocalStorageItem,
} from '../../../../functions';
import { ThemeText } from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import CustomToggleSwitch from '../../../../functions/CustomElements/switch';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import { handleLoginSecuritySwitch } from '../../../../functions/handleMnemonic';
import { useKeysContext } from '../../../../../context-store/keys';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import SettingsItemWithSlider from '../../../../functions/CustomElements/settings/settingsItemWithSlider';

export default function LoginSecurity({ extraData }) {
  const [securityLoginSettings, setSecurityLoginSettings] = useState({
    isSecurityEnabled: null,
    isPinEnabled: null,
    isBiometricEnabled: null,
  });
  const [useRandomPinLayout, setUseRandomPinLayout] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showSecurityChoice, setShowSecurityChoice] = useState(false);
  const { accountMnemoinc } = useKeysContext();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();

  const updateSecuritySettings = async newSettings => {
    setSecurityLoginSettings(newSettings);
    await setLocalStorageItem(
      LOGIN_SECUITY_MODE_KEY,
      JSON.stringify(newSettings),
    );
  };

  useEffect(() => {
    (async () => {
      const [saved, currentLayoutSetting] = await Promise.all([
        getLocalStorageItem(LOGIN_SECUITY_MODE_KEY).then(JSON.parse),
        getLocalStorageItem(RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY).then(JSON.parse),
      ]);

      if (saved) setSecurityLoginSettings(saved);
      setUseRandomPinLayout(currentLayoutSetting);
    })();
  }, []);

  useEffect(() => {
    if (!extraData?.pin) return;
    (async () => {
      try {
        setIsSwitching(true);
        const success = await handleLoginSecuritySwitch(
          accountMnemoinc,
          extraData.pin,
          'pin',
        );
        if (!success)
          throw new Error(t('settings.loginSecurity.unsuccesfullLoginSwitch'));

        await updateSecuritySettings({
          isSecurityEnabled: true,
          isPinEnabled: true,
          isBiometricEnabled: false,
        });
        setShowSecurityChoice(false);
      } catch (err) {
        console.log('PIN switch error:', err);
        navigate.navigate('ErrorScreen', { errorMessage: err.message });
      } finally {
        setIsSwitching(false);
      }
    })();
  }, [extraData]);

  const toggleSecurityEnabled = useCallback(async () => {
    try {
      if (!securityLoginSettings.isSecurityEnabled) {
        // Show choice when enabling security
        setShowSecurityChoice(true);
        return;
      }

      setIsSwitching(true);
      const success = await handleLoginSecuritySwitch(
        accountMnemoinc,
        '',
        'plain',
      );
      if (!success)
        throw new Error(t('settings.loginSecurity.toggleSecurityModeError'));

      await updateSecuritySettings({
        ...securityLoginSettings,
        isSecurityEnabled: false,
      });
      setShowSecurityChoice(false);
    } catch (err) {
      console.log('Toggle switch error:', err);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    } finally {
      setIsSwitching(false);
    }
  }, [securityLoginSettings]);

  const toggleUseRandomPinLayout = useCallback(async () => {
    try {
      setLocalStorageItem(
        RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY,
        JSON.stringify(!useRandomPinLayout),
      );
      setUseRandomPinLayout(!useRandomPinLayout);
    } catch (err) {
      console.log('Toggle switch error:', err);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    } finally {
    }
  }, [useRandomPinLayout]);

  const handleInitialSecurityChoice = useCallback(
    async type => {
      try {
        setIsSwitching(true);
        if (type === 'biometric') {
          if (!(await hasHardware())) {
            navigate.navigate('ErrorScreen', {
              errorMessage: t('settings.loginSecurity.noBiometricsError'),
            });
            return;
          }

          if (!(await hasSavedProfile())) {
            navigate.navigate('ErrorScreen', {
              errorMessage: t('settings.loginSecurity.noBiometricProfileError'),
            });
            return;
          }

          const success = await handleLoginSecuritySwitch(
            accountMnemoinc,
            '',
            'biometric',
          );
          if (!success)
            throw new Error(t('settings.loginSecurity.biometricSignInError'));

          await updateSecuritySettings({
            isSecurityEnabled: true,
            isBiometricEnabled: true,
            isPinEnabled: false,
          });
          setShowSecurityChoice(false);
        } else {
          // Navigate to PIN setup
          navigate.navigate('ConfirmPinForLoginMode');
          return;
        }
      } catch (err) {
        console.log('Initial security choice error:', err);
        navigate.navigate('ErrorScreen', { errorMessage: err.message });
        setShowSecurityChoice(false);
      } finally {
        setIsSwitching(false);
      }
    },
    [securityLoginSettings],
  );

  const toggleLoginSecurity = useCallback(
    async type => {
      try {
        setIsSwitching(true);
        if (type === 'biometric') {
          if (!(await hasHardware())) {
            navigate.navigate('ErrorScreen', {
              errorMessage: t('settings.loginSecurity.noBiometricsError'),
            });
            return;
          }

          if (!(await hasSavedProfile())) {
            navigate.navigate('ErrorScreen', {
              errorMessage: t('settings.loginSecurity.noBiometricProfileError'),
            });
            return;
          }

          const success = await handleLoginSecuritySwitch(
            accountMnemoinc,
            '',
            'biometric',
          );
          if (!success)
            throw new Error(t('settings.loginSecurity.biometricSignInError'));
        } else {
          navigate.navigate('ConfirmPinForLoginMode');
          return;
        }

        const updatedSettings = {
          ...securityLoginSettings,
          isBiometricEnabled: type === 'biometric',
          isPinEnabled: type === 'pin',
        };
        await updateSecuritySettings(updatedSettings);
      } catch (err) {
        console.log('Toggle security error:', err);
        navigate.navigate('ErrorScreen', { errorMessage: err.message });
      } finally {
        setIsSwitching(false);
      }
    },
    [securityLoginSettings],
  );

  if (isSwitching) {
    return (
      <FullLoadingScreen
        text={t('settings.loginSecurity.migratingStorageMessgae')}
      />
    );
  }

  return (
    <View style={styles.innerContainer}>
      <SettingsItemWithSlider
        CustomNumberOfLines={2}
        settingsTitle={t('settings.loginSecurity.text1')}
        showDescription={false}
        switchPageName={'LoginSecurityMode'}
        handleSubmit={toggleSecurityEnabled}
        toggleSwitchStateValue={securityLoginSettings.isSecurityEnabled}
        containerStyles={styles.switchContainer}
      />

      {showSecurityChoice && (
        <View style={{ width: '90%', ...CENTER }}>
          <ThemeText
            styles={styles.infoHeaders}
            content={t('settings.loginSecurity.text2')}
          />
          <TouchableOpacity
            onPress={() => handleInitialSecurityChoice('pin')}
            style={styles.toggleSecurityMode}
          >
            <ThemeText
              styles={{ includeFontPadding: false }}
              content={t('settings.loginSecurity.text3')}
            />
            <CheckMarkCircle isActive={false} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleInitialSecurityChoice('biometric')}
            style={styles.toggleSecurityMode}
          >
            <ThemeText
              styles={{ includeFontPadding: false }}
              content={t('settings.loginSecurity.text4')}
            />
            <CheckMarkCircle isActive={false} />
          </TouchableOpacity>
        </View>
      )}

      {securityLoginSettings.isSecurityEnabled && (
        <>
          <View style={{ width: '90%', ...CENTER }}>
            <ThemeText
              styles={styles.infoHeaders}
              content={t('settings.loginSecurity.text2')}
            />
            <TouchableOpacity
              onPress={() => toggleLoginSecurity('pin')}
              style={styles.toggleSecurityMode}
            >
              <ThemeText
                styles={{ includeFontPadding: false }}
                content={t('settings.loginSecurity.text3')}
              />
              <CheckMarkCircle isActive={securityLoginSettings.isPinEnabled} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleLoginSecurity('biometric')}
              style={styles.toggleSecurityMode}
            >
              <ThemeText
                styles={{ includeFontPadding: false }}
                content={t('settings.loginSecurity.text4')}
              />
              <CheckMarkCircle
                isActive={securityLoginSettings.isBiometricEnabled}
              />
            </TouchableOpacity>
          </View>
          {securityLoginSettings.isPinEnabled && (
            <SettingsItemWithSlider
              CustomNumberOfLines={2}
              settingsTitle={t(
                'settings.loginSecurity.randomPinKeyboardToggle',
              )}
              showDescription={false}
              switchPageName={'useRanomPinLayout'}
              handleSubmit={toggleUseRandomPinLayout}
              toggleSwitchStateValue={useRandomPinLayout}
              containerStyles={styles.switchContainer}
              showInformationPopup={true}
              informationPopupText={t(
                'settings.loginSecurity.randomPinKeyboardInfo',
              )}
              informationPopupBTNText={t('constants.iunderstand')}
            />
          )}
        </>
      )}
    </View>
  );
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
  switchContainer: { marginVertical: 0 },

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
