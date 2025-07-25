import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {CENTER, COLORS, LOGIN_SECUITY_MODE_KEY} from '../../../../constants';
import {useCallback, useEffect, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {
  getLocalStorageItem,
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
import {handleLoginSecuritySwitch} from '../../../../functions/handleMnemonic';
import {useKeysContext} from '../../../../../context-store/keys';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';

export default function LoginSecurity({extraData}) {
  const [securityLoginSettings, setSecurityLoginSettings] = useState({
    isSecurityEnabled: null,
    isPinEnabled: null,
    isBiometricEnabled: null,
  });
  const [isSwitching, setIsSwitching] = useState(false);
  const {accountMnemoinc} = useKeysContext();
  const navigate = useNavigation();
  const {t} = useTranslation();
  const {theme} = useGlobalThemeContext();
  const {backgroundOffset} = GetThemeColors();

  const updateSecuritySettings = async newSettings => {
    setSecurityLoginSettings(newSettings);
    await setLocalStorageItem(
      LOGIN_SECUITY_MODE_KEY,
      JSON.stringify(newSettings),
    );
  };

  useEffect(() => {
    (async () => {
      const saved = await getLocalStorageItem(LOGIN_SECUITY_MODE_KEY);
      if (saved) setSecurityLoginSettings(JSON.parse(saved));
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
        if (!success) throw new Error('Unable to switch login type');

        await updateSecuritySettings({
          isSecurityEnabled: true,
          isPinEnabled: true,
          isBiometricEnabled: false,
        });
      } catch (err) {
        console.log('PIN switch error:', err);
        navigate.navigate('ErrorScreen', {errorMessage: err.message});
      } finally {
        setIsSwitching(false);
      }
    })();
  }, [extraData]);

  const toggleSecurityEnabled = useCallback(async () => {
    try {
      setIsSwitching(true);
      if (!securityLoginSettings.isSecurityEnabled) {
        navigate.navigate('ConfirmPinForLoginMode');
        return;
      }

      const success = await handleLoginSecuritySwitch(
        accountMnemoinc,
        '',
        'plain',
      );
      if (!success) throw new Error('Toggle failed');

      await updateSecuritySettings({
        ...securityLoginSettings,
        isSecurityEnabled: false,
      });
    } catch (err) {
      console.log('Toggle switch error:', err);
      navigate.navigate('ErrorScreen', {errorMessage: err.message});
    } finally {
      setIsSwitching(false);
    }
  }, [securityLoginSettings]);

  const toggleLoginSecurity = useCallback(
    async type => {
      try {
        setIsSwitching(true);
        if (type === 'biometric') {
          if (!(await hasHardware())) {
            navigate.navigate('ErrorScreen', {
              errorMessage: 'Device does not support Biometric login',
            });
            return;
          }

          if (!(await hasSavedProfile())) {
            navigate.navigate('ErrorScreen', {
              errorMessage:
                'Device does not have a Biometric profile. Create one in settings to continue.',
            });
            return;
          }

          const success = await handleLoginSecuritySwitch(
            accountMnemoinc,
            '',
            'biometric',
          );
          if (!success) throw new Error('Error logging in with Biometrics');
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
        navigate.navigate('ErrorScreen', {errorMessage: err.message});
      } finally {
        setIsSwitching(false);
      }
    },
    [securityLoginSettings],
  );

  if (isSwitching) {
    return <FullLoadingScreen text={'Migrating storage to new security.'} />;
  }

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
            toggleSwitchFunction={toggleSecurityEnabled}
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
            onPress={() => toggleLoginSecurity('pin')}
            style={styles.toggleSecurityMode}>
            <ThemeText content={t('settings.loginsecurity.text3')} />
            <CheckMarkCircle isActive={securityLoginSettings.isPinEnabled} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggleLoginSecurity('biometric')}
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
