import {
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
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
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import {
  decryptMnemonicWithPin,
  handleLoginSecuritySwitch,
  storeMnemonicWithPinSecurity,
} from '../../../../functions/handleMnemonic';
import { useKeysContext } from '../../../../../context-store/keys';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import CustomButton from '../../../../functions/CustomElements/button';
import PasswordCreateForm from '../../../admin/loginComponents/passwordCreateForm';
import { useToast } from '../../../../../context-store/toastManager';

const SettingsSection = ({ title, children, style }) => (
  <View style={[styles.section, style]}>
    {title ? <ThemeText styles={styles.sectionTitle} content={title} /> : null}
    {children}
  </View>
);

const SettingsItem = ({ label, children, isLast, dividerColor }) => (
  <>
    <View style={styles.settingsItem}>
      <View style={styles.settingsItemText}>
        <ThemeText styles={styles.settingsItemLabel} content={label} />
      </View>
      {children}
    </View>
    {!isLast && (
      <View style={[styles.divider, { backgroundColor: dividerColor }]} />
    )}
  </>
);

function WebChangePassword() {
  const { accountMnemoinc } = useKeysContext();
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const verifyCurrent = async () => {
    if (!currentPassword) return;
    setIsVerifying(true);
    setError('');
    try {
      const seed = await decryptMnemonicWithPin(
        JSON.stringify(currentPassword),
      );
      if (seed && seed === accountMnemoinc) {
        setStep(2);
      } else {
        setError(
          t('settings.loginSecurity.wrongCurrentPassword', 'Wrong password'),
        );
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleNewPassword = async newPassword => {
    setIsSubmitting(true);
    try {
      const ok = await storeMnemonicWithPinSecurity(
        accountMnemoinc,
        newPassword,
      );
      if (ok) {
        showToast({
          type: 'success',
          text: t('settings.loginSecurity.passwordChanged', 'Password updated'),
        });
        setStep(1);
        setCurrentPassword('');
        setError('');
      } else {
        setError(
          t(
            'settings.loginSecurity.passwordChangeFailed',
            'Failed to update password',
          ),
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 2) {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.innerContainer}
        contentContainerStyle={[
          styles.scrollContent,
          { flexGrow: 1, paddingBottom: 0 },
        ]}
      >
        <PasswordCreateForm
          headerText={t(
            'settings.loginSecurity.newPasswordHeader',
            'New Password',
          )}
          subtitleText={t(
            'settings.loginSecurity.newPasswordSubtitle',
            'Choose a new password.',
          )}
          buttonText={t(
            'settings.loginSecurity.changePasswordButton',
            'Change Password',
          )}
          onSubmit={handleNewPassword}
          isSubmitting={isSubmitting}
        />
        {!!error && <ThemeText styles={styles.webErrorText} content={error} />}
        <TouchableOpacity
          style={{ marginTop: 15 }}
          onPress={() => {
            setStep(1);
            setError('');
          }}
        >
          <ThemeText
            content={t('constants.back', 'Back')}
            styles={{ textAlign: 'center' }}
          />
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.innerContainer}
      contentContainerStyle={styles.scrollContent}
    >
      <SettingsSection>
        <View
          style={[styles.sectionContent, { backgroundColor: backgroundOffset }]}
        >
          <ThemeText
            styles={{ marginBottom: 10 }}
            content={t('settings.loginSecurity.currentPasswordSubtitle')}
          />
          <CustomSearchInput
            inputText={currentPassword}
            setInputText={setCurrentPassword}
            placeholderText={t(
              'settings.loginSecurity.currentPasswordPlaceholder',
            )}
            secureTextEntry={true}
            autoComplete="current-password"
            textContentType="password"
          />
          {!!error && (
            <ThemeText styles={styles.webErrorText} content={error} />
          )}
          <View style={{ marginTop: 15 }}>
            <CustomButton
              textContent={t('constants.continue')}
              actionFunction={verifyCurrent}
              disabled={!currentPassword || isVerifying}
              useLoading={isVerifying}
            />
          </View>
        </View>
      </SettingsSection>
    </ScrollView>
  );
}

function LoginSecurityNative({ extraData }) {
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
  const { backgroundOffset, backgroundColor } = GetThemeColors();

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

      if (saved) {
        setSecurityLoginSettings(saved);
      } else {
        const defaultConfig = {
          isSecurityEnabled: true,
          isPinEnabled: true,
          isBiometricEnabled: false,
        };
        setSecurityLoginSettings(defaultConfig);
        await updateSecuritySettings(defaultConfig);
      }
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
          throw new Error(t('settings.loginSecurity.unsuccessfulLoginSwitch'));

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

  const toggleSecurityEnabled = useCallback(() => {
    // Security can only be enabled, never disabled.
    setShowSecurityChoice(true);
  }, []);

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
        text={t('settings.loginSecurity.migratingStorageMessage')}
      />
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.innerContainer}
      contentContainerStyle={styles.scrollContent}
    >
      {securityLoginSettings.isSecurityEnabled === false && (
        <SettingsSection>
          <View
            style={[
              styles.sectionContent,
              { backgroundColor: backgroundOffset },
            ]}
          >
            <SettingsItem
              isLast
              dividerColor={backgroundColor}
              label={t('settings.loginSecurity.text1')}
            >
              <CustomToggleSwitch
                page="LoginSecurityMode"
                toggleSwitchFunction={toggleSecurityEnabled}
                stateValue={securityLoginSettings.isSecurityEnabled}
              />
            </SettingsItem>
          </View>
        </SettingsSection>
      )}

      {showSecurityChoice && (
        <SettingsSection title={t('settings.loginSecurity.text2')}>
          <View
            style={[
              styles.sectionContent,
              { backgroundColor: backgroundOffset },
            ]}
          >
            <TouchableOpacity
              onPress={() => handleInitialSecurityChoice('pin')}
              style={styles.securityMethodRow}
            >
              <ThemeText
                styles={styles.settingsItemLabel}
                content={t('settings.loginSecurity.text3')}
              />
              <CheckMarkCircle
                containerSize={25}
                isActive={false}
                switchDarkMode={true}
              />
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor }]} />
            <TouchableOpacity
              onPress={() => handleInitialSecurityChoice('biometric')}
              style={styles.securityMethodRow}
            >
              <ThemeText
                styles={styles.settingsItemLabel}
                content={t('settings.loginSecurity.text4')}
              />
              <CheckMarkCircle
                containerSize={25}
                isActive={false}
                switchDarkMode={true}
              />
            </TouchableOpacity>
          </View>
        </SettingsSection>
      )}

      {securityLoginSettings.isSecurityEnabled && (
        <>
          <SettingsSection title={t('settings.loginSecurity.text2')}>
            <View
              style={[
                styles.sectionContent,
                { backgroundColor: backgroundOffset },
              ]}
            >
              <TouchableOpacity
                onPress={() => toggleLoginSecurity('pin')}
                style={styles.securityMethodRow}
              >
                <ThemeText
                  styles={styles.settingsItemLabel}
                  content={t('settings.loginSecurity.text3')}
                />
                <CheckMarkCircle
                  containerSize={25}
                  isActive={securityLoginSettings.isPinEnabled}
                  switchDarkMode={true}
                />
              </TouchableOpacity>
              <View style={[styles.divider, { backgroundColor }]} />
              <TouchableOpacity
                onPress={() => toggleLoginSecurity('biometric')}
                style={styles.securityMethodRow}
              >
                <ThemeText
                  styles={styles.settingsItemLabel}
                  content={t('settings.loginSecurity.text4')}
                />
                <CheckMarkCircle
                  containerSize={25}
                  isActive={securityLoginSettings.isBiometricEnabled}
                  switchDarkMode={true}
                />
              </TouchableOpacity>
            </View>
          </SettingsSection>

          {securityLoginSettings.isBiometricEnabled && (
            <View style={styles.biometricsWarningContainer}>
              <ThemeIcon iconName={'TriangleAlert'} />
              <ThemeText
                styles={styles.emptyTitle}
                content={t('settings.loginSecurity.biometricsHead')}
              />
              <ThemeText
                styles={styles.emptySubtext}
                content={t('settings.loginSecurity.biometricsSubHead')}
              />
            </View>
          )}

          {securityLoginSettings.isPinEnabled && (
            <SettingsSection style={styles.lastSection}>
              <View
                style={[
                  styles.sectionContent,
                  { backgroundColor: backgroundOffset },
                ]}
              >
                <SettingsItem
                  isLast
                  dividerColor={backgroundColor}
                  label={t('settings.loginSecurity.randomPinKeyboardToggle')}
                >
                  <View style={styles.rightContainer}>
                    <TouchableOpacity
                      style={styles.infoButton}
                      onPress={() =>
                        navigate.navigate('InformationPopup', {
                          textContent: t(
                            'settings.loginSecurity.randomPinKeyboardInfo',
                          ),
                          buttonText: t('constants.iunderstand'),
                        })
                      }
                    >
                      <ThemeIcon size={20} iconName="Info" />
                    </TouchableOpacity>
                    <CustomToggleSwitch
                      page="useRanomPinLayout"
                      toggleSwitchFunction={toggleUseRandomPinLayout}
                      stateValue={useRandomPinLayout}
                    />
                  </View>
                </SettingsItem>
              </View>
            </SettingsSection>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
    width: '100%',
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: SIZES.small,
    textTransform: 'uppercase',
    opacity: 0.7,
    marginBottom: 16,
    includeFontPadding: false,
  },
  sectionContent: {
    width: '100%',
    borderRadius: 8,
    padding: 16,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsItemText: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  settingsItemLabel: {
    includeFontPadding: false,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  securityMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoButton: {
    marginRight: 8,
  },
  biometricsWarningContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
  },
  emptyTitle: {
    fontSize: SIZES.large,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
  },
  webErrorText: {
    fontSize: SIZES.small,
    color: '#e74c3c',
    marginTop: 8,
  },
});

export default function LoginSecurity(props) {
  if (Platform.OS === 'web') {
    return <WebChangePassword />;
  }
  return <LoginSecurityNative {...props} />;
}
