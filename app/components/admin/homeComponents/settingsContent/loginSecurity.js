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
import { useCallback, useEffect, useRef, useState } from 'react';
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

import PasskeyIcon from '../../../admin/loginComponents/passkeyIcon';
import {
  createPasskey,
  decryptMnemonicWithPasskey,
  forgetPasskey,
  getStoredPasskeyInfo,
  isPasskeySupported,
  passkeyName,
  storeMnemonicWithPasskey,
} from '../../../../functions/passkeyMnemonic';

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

// Web login security, read from the stored envelope: a password wallet
// (change password, or switch to a passkey) or a passkey wallet (switch back
// to a password). A wallet always has exactly one unlock method.
function WebLoginSecurity() {
  // undefined while loading, null for a password wallet.
  const [passkeyInfo, setPasskeyInfo] = useState(undefined);
  const [canUsePasskey, setCanUsePasskey] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const { t } = useTranslation();

  // Re-read after every switch attempt: the envelope is the only source of
  // truth, and a write that reported failure may still have landed.
  const refresh = useCallback(async () => {
    try {
      const info = await getStoredPasskeyInfo();
      setPasskeyInfo(info);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    isPasskeySupported().then(setCanUsePasskey, () => setCanUsePasskey(false));
  }, [refresh]);

  if (loadFailed)
    return (
      <View style={styles.innerContainer}>
        <ThemeText content={t('settings.loginSecurity.loadError')} />
        <CustomButton
          textContent={t('createAccount.keySetup.passkey.tryAgain')}
          actionFunction={refresh}
        />
      </View>
    );
  if (passkeyInfo === undefined) return null;
  if (passkeyInfo) {
    return <WebPasskeySettings passkeyInfo={passkeyInfo} onChanged={refresh} />;
  }
  return (
    <WebChangePassword canUsePasskey={canUsePasskey} onChanged={refresh} />
  );
}

// Step 2 of both web flows: pick a new password, or go back.
function NewPasswordStep({
  subtitleText,
  buttonText,
  onSubmit,
  isSubmitting,
  error,
  onBack,
}) {
  const { t } = useTranslation();
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
        subtitleText={subtitleText}
        buttonText={buttonText}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
      />
      {!!error && <ThemeText styles={styles.webErrorText} content={error} />}
      <TouchableOpacity
        style={{ marginTop: 15 }}
        onPress={onBack}
        disabled={isSubmitting}
      >
        <ThemeText
          content={t('constants.back', 'Back')}
          styles={{ textAlign: 'center' }}
        />
      </TouchableOpacity>
    </ScrollView>
  );
}

function WebChangePassword({ canUsePasskey, onChanged }) {
  const { accountMnemoinc } = useKeysContext();
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [step, setStep] = useState(1);
  // Set by "Use a passkey instead": the current-password check then leads to
  // the passkey prompts instead of step 2.
  const [isSwitchingToPasskey, setIsSwitchingToPasskey] = useState(false);
  // A created passkey whose confirm prompt failed. [Try again] reuses it so a
  // second one is never registered.
  const [pendingCredentialId, setPendingCredentialId] = useState(null);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isVerifyingRef = useRef(false);
  const isWritingRef = useRef(false);
  // Ref, not state: a double tap must not open a second create prompt.
  const isPasskeyBusyRef = useRef(false);

  const unsupportedMessage = t(
    'createAccount.keySetup.passkey.unsupported',
    "Your password manager can't protect a wallet with a passkey yet. Set a password instead.",
  );

  // Create (unless retrying) + confirm. The passkey envelope replaces the
  // password one in a single write, only after both prompts succeeded.
  const setUpPasskey = async existingCredentialId => {
    if (isPasskeyBusyRef.current) return;
    isPasskeyBusyRef.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      let credentialId = existingCredentialId;
      if (!credentialId) {
        const created = await createPasskey();
        if (created.status === 'cancelled') return;
        if (created.status !== 'ok') {
          setError(unsupportedMessage);
          return;
        }
        credentialId = created.credentialId;
      }
      const result = await storeMnemonicWithPasskey(
        accountMnemoinc,
        credentialId,
      );
      if (result === 'confirm-failed') {
        setPendingCredentialId(credentialId);
        return;
      }
      setPendingCredentialId(null);
      if (result === 'ok') {
        showToast({
          type: 'clipboard',
          title: t('settings.loginSecurity.passkeyCreated', 'Passkey created'),
        });
      } else if (result === 'unsupported') {
        forgetPasskey(credentialId);
        setError(unsupportedMessage);
      } else {
        setError(
          t(
            'settings.loginSecurity.passkeySetupFailed',
            'Failed to set up passkey',
          ),
        );
      }
      await onChanged();
    } catch {
      setError(t('settings.loginSecurity.passkeySetupFailed'));
      await onChanged();
    } finally {
      isPasskeyBusyRef.current = false;
      setIsSubmitting(false);
    }
  };

  const abandonPasskey = () => {
    if (isVerifyingRef.current || isPasskeyBusyRef.current) return;
    forgetPasskey(pendingCredentialId);
    setPendingCredentialId(null);
    setIsSwitchingToPasskey(false);
    setCurrentPassword('');
  };

  const verifyCurrent = async () => {
    if (
      !currentPassword ||
      isVerifyingRef.current ||
      isPasskeyBusyRef.current ||
      isWritingRef.current
    )
      return;
    isVerifyingRef.current = true;
    setIsVerifying(true);
    setError('');
    try {
      const seed = await decryptMnemonicWithPin(
        JSON.stringify(currentPassword),
      );
      if (seed && seed === accountMnemoinc) {
        if (isSwitchingToPasskey) await setUpPasskey(null);
        else setStep(2);
      } else {
        setError(
          t('settings.loginSecurity.wrongCurrentPassword', 'Wrong password'),
        );
      }
    } catch {
      setError(t('settings.loginSecurity.wrongCurrentPassword'));
    } finally {
      isVerifyingRef.current = false;
      setIsVerifying(false);
    }
  };

  const handleNewPassword = async newPassword => {
    if (isWritingRef.current || isVerifyingRef.current) return;
    isWritingRef.current = true;
    setIsSubmitting(true);
    try {
      const ok = await storeMnemonicWithPinSecurity(
        accountMnemoinc,
        newPassword,
      );
      if (ok) {
        showToast({
          type: 'success',
          title: t(
            'settings.loginSecurity.passwordChanged',
            'Password updated',
          ),
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
    } catch {
      setError(t('settings.loginSecurity.passwordChangeFailed'));
      await onChanged();
    } finally {
      isWritingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (step === 2) {
    return (
      <NewPasswordStep
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
        error={error}
        onBack={() => {
          if (isWritingRef.current) return;
          setStep(1);
          setError('');
        }}
      />
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
          {pendingCredentialId ? (
            <>
              <ThemeText
                styles={{ marginBottom: 15 }}
                content={t(
                  'createAccount.keySetup.passkey.confirmFailed',
                  "Couldn't confirm your passkey",
                )}
              />
              <CustomButton
                textContent={t(
                  'createAccount.keySetup.passkey.tryAgain',
                  'Try again',
                )}
                actionFunction={() => setUpPasskey(pendingCredentialId)}
                disabled={isSubmitting}
                useLoading={isSubmitting}
              />
              <TouchableOpacity
                testID="use-password-instead"
                style={{ marginTop: 15 }}
                onPress={abandonPasskey}
                disabled={isSubmitting}
              >
                <ThemeText
                  styles={{ textAlign: 'center' }}
                  content={t(
                    'createAccount.keySetup.passkey.usePassword',
                    'Use a password instead',
                  )}
                />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ThemeText
                styles={{ marginBottom: 10 }}
                content={
                  isSwitchingToPasskey
                    ? t(
                        'settings.loginSecurity.passkeyPasswordSubtitle',
                        'Enter your current password to switch to a passkey.',
                      )
                    : t('settings.loginSecurity.currentPasswordSubtitle')
                }
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
                  disabled={!currentPassword || isVerifying || isSubmitting}
                  useLoading={isVerifying || isSubmitting}
                />
              </View>
              {isSwitchingToPasskey && (
                <TouchableOpacity
                  style={{ marginTop: 15 }}
                  disabled={isVerifying || isSubmitting}
                  onPress={() => {
                    if (isVerifyingRef.current || isPasskeyBusyRef.current)
                      return;
                    setIsSwitchingToPasskey(false);
                    setError('');
                  }}
                >
                  <ThemeText
                    content={t('constants.back', 'Back')}
                    styles={{ textAlign: 'center' }}
                  />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </SettingsSection>
      {canUsePasskey && !isSwitchingToPasskey && (
        <SettingsSection>
          <View
            style={[
              styles.sectionContent,
              styles.passkeyCard,
              { backgroundColor: backgroundOffset },
            ]}
          >
            <PasskeyIcon size={40} />
            <ThemeText
              styles={styles.passkeyTitle}
              content={t(
                'settings.loginSecurity.passkeyCardTitle',
                'Use a passkey instead',
              )}
            />
            <ThemeText
              styles={styles.passkeyText}
              content={t(
                'settings.loginSecurity.passkeyCardBody',
                'Unlock with your face, fingerprint, or device PIN. Your passkey replaces your password.',
              )}
            />
            <CustomButton
              buttonStyles={{ marginTop: 15 }}
              textContent={t(
                'createAccount.keySetup.passkey.createButton',
                'Create a passkey',
              )}
              disabled={isVerifying || isSubmitting}
              actionFunction={() => {
                if (isVerifyingRef.current || isWritingRef.current) return;
                setIsSwitchingToPasskey(true);
                setError('');
              }}
            />
          </View>
        </SettingsSection>
      )}
    </ScrollView>
  );
}

function WebPasskeySettings({ passkeyInfo, onChanged }) {
  const { accountMnemoinc } = useKeysContext();
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isVerifyingRef = useRef(false);
  const isWritingRef = useRef(false);

  // Unlock with the passkey first, like the current-password check on a
  // password wallet.
  const verifyPasskey = async () => {
    if (isVerifyingRef.current || isWritingRef.current) return;
    isVerifyingRef.current = true;
    setIsVerifying(true);
    setError('');
    try {
      const seed = await decryptMnemonicWithPasskey();
      if (seed && seed === accountMnemoinc) {
        setStep(2);
      } else if (seed !== null) {
        setError(
          t(
            'adminLogin.passkeyPage.unlockError',
            "Couldn't unlock with your passkey",
          ),
        );
      }
    } catch {
      setError(t('adminLogin.passkeyPage.unlockError'));
    } finally {
      isVerifyingRef.current = false;
      setIsVerifying(false);
    }
  };

  const handleNewPassword = async newPassword => {
    if (isWritingRef.current || isVerifyingRef.current) return;
    isWritingRef.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      const ok = await storeMnemonicWithPinSecurity(
        accountMnemoinc,
        newPassword,
      );
      if (ok) {
        // Only once the password envelope was written and read back.
        await forgetPasskey(passkeyInfo.credentialId);
        showToast({
          type: 'success',
          title: t(
            'settings.loginSecurity.switchedToPassword',
            'Switched to password',
          ),
        });
      } else {
        setError(
          t(
            'settings.loginSecurity.passwordChangeFailed',
            'Failed to update password',
          ),
        );
      }
      await onChanged();
    } catch {
      setError(t('settings.loginSecurity.passwordChangeFailed'));
      await onChanged();
    } finally {
      isWritingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (step === 2) {
    return (
      <NewPasswordStep
        subtitleText={t(
          'settings.loginSecurity.switchToPasswordSubtitle',
          'Choose a password. It replaces your passkey.',
        )}
        buttonText={t(
          'settings.loginSecurity.switchToPassword',
          'Switch to password',
        )}
        onSubmit={handleNewPassword}
        isSubmitting={isSubmitting}
        error={error}
        onBack={() => {
          if (isWritingRef.current) return;
          setStep(1);
          setError('');
        }}
      />
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
          style={[
            styles.sectionContent,
            styles.passkeyCard,
            { backgroundColor: backgroundOffset },
          ]}
        >
          <PasskeyIcon size={40} />
          <ThemeText
            styles={styles.passkeyTitle}
            content={t('settings.loginSecurity.passkeyTitle', 'Passkey')}
          />
          <ThemeText
            styles={styles.passkeyText}
            content={t('settings.loginSecurity.passkeyCreatedOn', {
              defaultValue: 'Created {{date}}',
              date: new Date(passkeyInfo.createdAt).toLocaleDateString(),
            })}
          />
          <ThemeText
            styles={styles.passkeyText}
            content={t('settings.loginSecurity.passkeySavedAs', {
              defaultValue: 'Saved in your password manager as {{name}}',
              name: passkeyName(passkeyInfo.createdAt),
            })}
          />
          {!!error && (
            <ThemeText styles={styles.webErrorText} content={error} />
          )}
          <CustomButton
            buttonStyles={{ marginTop: 15 }}
            textContent={t(
              'settings.loginSecurity.switchToPassword',
              'Switch to password',
            )}
            actionFunction={verifyPasskey}
            disabled={isVerifying}
            useLoading={isVerifying}
          />
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
  passkeyCard: {
    alignItems: 'center',
  },
  passkeyTitle: {
    fontSize: SIZES.large,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 6,
  },
  passkeyText: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
  },
});

export default function LoginSecurity(props) {
  if (Platform.OS === 'web') {
    return <WebLoginSecurity />;
  }
  return <LoginSecurityNative {...props} />;
}
