import { Platform, StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import {
  FONT,
  LOGIN_SECUITY_MODE_KEY,
  RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY,
  RANDOM_LOGIN_KEYBOARD_INFO_SEEN_KEY,
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
import { HIDDEN_OPACITY, SIZES } from '../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import {
  decryptMnemonicWithPin,
  handleLoginSecuritySwitch,
  storeMnemonicWithPinSecurity,
} from '../../../../functions/handleMnemonic';
import { useKeysContext } from '../../../../../context-store/keys';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import PasswordField from '../../../admin/loginComponents/passwordField';
import TextButton from '../../../../functions/CustomElements/redesign/TextButton';
import CustomButton from '../../../../functions/CustomElements/button';
import PasswordCreateForm from '../../../admin/loginComponents/passwordCreateForm';
import { useToast } from '../../../../../context-store/toastManager';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import PickRow from '../../../../functions/CustomElements/redesign/PickRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';

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

// Web counterpart of the native "Unlock with" picker: PIN is the password and
// biometrics is the passkey. Selecting the other method starts its switch flow.
function WebUnlockMethodRows({
  isPasskey = false,
  canUsePasskey = false,
  onChoosePassword,
  onChoosePasskey,
  disabled = false,
}) {
  const { t } = useTranslation();
  return (
    <>
      <SectionHeader title={t('settings.loginSecurity.text2')} first />
      <ListCard dividerInset={48}>
        <PickRow
          title={t('settings.loginSecurity.passwordMethod', 'Password')}
          lead={<Disc icon="Lock" />}
          selected={!isPasskey}
          minHeight={52}
          titleStyle={styles.rowTitle}
          onPress={isPasskey && !disabled ? onChoosePassword : undefined}
        />
        {canUsePasskey && (
          <PickRow
            title={t('settings.loginSecurity.text4')}
            lead={<Disc icon="FingerprintPattern" />}
            selected={isPasskey}
            minHeight={52}
            titleStyle={styles.rowTitle}
            onPress={!isPasskey && !disabled ? onChoosePasskey : undefined}
          />
        )}
      </ListCard>
    </>
  );
}

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
          size="regular"
          tone="primary"
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
  const { tokens } = GetThemeColors();
  return (
    <CustomScrollView
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
      {!!error && (
        <ThemeText
          variant="body"
          styles={[styles.webErrorText, { color: tokens.danger }]}
          content={error}
        />
      )}
      <TextButton
        text={t('constants.back', 'Back')}
        align="center"
        textStyle={styles.backText}
        disabled={isSubmitting}
        onPress={onBack}
      />
    </CustomScrollView>
  );
}

function WebChangePassword({ canUsePasskey, onChanged }) {
  const { accountMnemoinc } = useKeysContext();
  const { t } = useTranslation();
  const { tokens } = GetThemeColors();
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
    <CustomScrollView
      showsVerticalScrollIndicator={false}
      style={styles.innerContainer}
      contentContainerStyle={styles.scrollContent}
    >
      <WebUnlockMethodRows
        canUsePasskey={canUsePasskey}
        onChoosePasskey={() => {
          if (isVerifyingRef.current || isWritingRef.current) return;
          setIsSwitchingToPasskey(true);
          setError('');
        }}
        disabled={isVerifying || isSubmitting || !!pendingCredentialId}
      />
      <View style={styles.stepBlock}>
        {pendingCredentialId ? (
          <>
            <ThemeText
              variant="body"
              styles={styles.stepText}
              content={t(
                'createAccount.keySetup.passkey.confirmFailed',
                "Couldn't confirm your passkey",
              )}
            />
            <CustomButton
              size="regular"
              tone="primary"
              textContent={t(
                'createAccount.keySetup.passkey.tryAgain',
                'Try again',
              )}
              actionFunction={() => setUpPasskey(pendingCredentialId)}
              disabled={isSubmitting}
              useLoading={isSubmitting}
            />
            <TextButton
              testID="use-password-instead"
              text={t(
                'createAccount.keySetup.passkey.usePassword',
                'Use a password instead',
              )}
              align="center"
              textStyle={styles.backText}
              disabled={isSubmitting}
              onPress={abandonPasskey}
            />
          </>
        ) : (
          <>
            <ThemeText
              variant="body"
              styles={[styles.stepText, { color: tokens.muted }]}
              content={
                isSwitchingToPasskey
                  ? t(
                      'settings.loginSecurity.passkeyPasswordSubtitle',
                      'Enter your current password to switch to a passkey.',
                    )
                  : t('settings.loginSecurity.currentPasswordSubtitle')
              }
            />
            <PasswordField
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder={t(
                'settings.loginSecurity.currentPasswordPlaceholder',
              )}
              autoComplete="current-password"
              textContentType="password"
            />
            {!!error && (
              <ThemeText
                variant="body"
                styles={[styles.webErrorText, { color: tokens.danger }]}
                content={error}
              />
            )}
            <View style={styles.stepButton}>
              <CustomButton
                size="regular"
                tone="primary"
                textContent={t('constants.continue')}
                actionFunction={verifyCurrent}
                disabled={!currentPassword || isVerifying || isSubmitting}
                useLoading={isVerifying || isSubmitting}
              />
            </View>
            {isSwitchingToPasskey && (
              <TextButton
                text={t('constants.back', 'Back')}
                align="center"
                textStyle={styles.backText}
                disabled={isVerifying || isSubmitting}
                onPress={() => {
                  if (isVerifyingRef.current || isPasskeyBusyRef.current)
                    return;
                  setIsSwitchingToPasskey(false);
                  setError('');
                }}
              />
            )}
          </>
        )}
      </View>
    </CustomScrollView>
  );
}

function WebPasskeySettings({ passkeyInfo, onChanged }) {
  const { accountMnemoinc } = useKeysContext();
  const { t } = useTranslation();
  const { tokens } = GetThemeColors();
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
    <CustomScrollView
      showsVerticalScrollIndicator={false}
      style={styles.innerContainer}
      contentContainerStyle={styles.scrollContent}
    >
      <WebUnlockMethodRows
        isPasskey
        canUsePasskey
        onChoosePassword={verifyPasskey}
        disabled={isVerifying || isSubmitting}
      />
      {!!error && (
        <ThemeText
          variant="body"
          styles={[styles.webErrorText, { color: tokens.danger }]}
          content={error}
        />
      )}
    </CustomScrollView>
  );
}

function LoginSecurityNative({ extraData }) {
  const [securityLoginSettings, setSecurityLoginSettings] = useState({
    isSecurityEnabled: null,
    isPinEnabled: null,
    isBiometricEnabled: null,
  });
  const [useRandomPinLayout, setUseRandomPinLayout] = useState(false);
  const [hasSeenRandomPinInfo, setHasSeenRandomPinInfo] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showSecurityChoice, setShowSecurityChoice] = useState(false);
  const { accountMnemoinc } = useKeysContext();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = GetThemeColors();

  const updateSecuritySettings = async newSettings => {
    setSecurityLoginSettings(newSettings);
    await setLocalStorageItem(
      LOGIN_SECUITY_MODE_KEY,
      JSON.stringify(newSettings),
    );
  };

  useEffect(() => {
    (async () => {
      const [saved, currentLayoutSetting, infoSeen] = await Promise.all([
        getLocalStorageItem(LOGIN_SECUITY_MODE_KEY).then(JSON.parse),
        getLocalStorageItem(RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY).then(JSON.parse),
        getLocalStorageItem(RANDOM_LOGIN_KEYBOARD_INFO_SEEN_KEY),
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
      setHasSeenRandomPinInfo(!!infoSeen);
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
      const nextValue = !useRandomPinLayout;
      setLocalStorageItem(
        RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY,
        JSON.stringify(nextValue),
      );
      setUseRandomPinLayout(nextValue);

      if (nextValue && !hasSeenRandomPinInfo) {
        setLocalStorageItem(RANDOM_LOGIN_KEYBOARD_INFO_SEEN_KEY, 'true');
        setHasSeenRandomPinInfo(true);
        navigate.navigate('InformationPopup', {
          textContent: t('settings.loginSecurity.randomPinKeyboardInfo'),
          buttonText: t('constants.iunderstand'),
        });
      }
    } catch (err) {
      console.log('Toggle switch error:', err);
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    }
  }, [useRandomPinLayout, hasSeenRandomPinInfo, navigate, t]);

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

  const selectMethod = (onSelect, type) => {
    if (
      (type === 'pin' && securityLoginSettings.isPinEnabled) ||
      (type === 'biometric' && securityLoginSettings.isBiometricEnabled)
    ) {
      return;
    }
    onSelect(type);
  };

  return (
    <CustomScrollView
      showsVerticalScrollIndicator={false}
      style={styles.innerContainer}
      contentContainerStyle={styles.scrollContent}
    >
      {securityLoginSettings.isSecurityEnabled === false && (
        <ListCard style={styles.firstCard}>
          <ListRow
            title={t('settings.loginSecurity.text1')}
            minHeight={52}
            titleStyle={styles.rowTitle}
            trailing="switch"
            value={securityLoginSettings.isSecurityEnabled}
            onPress={toggleSecurityEnabled}
          />
        </ListCard>
      )}

      {showSecurityChoice && (
        <>
          <SectionHeader
            title={t('settings.loginSecurity.text2')}
            first={securityLoginSettings.isSecurityEnabled === false}
          />
          <ListCard dividerInset={48}>
            <PickRow
              title={t('settings.loginSecurity.text3')}
              lead={<Disc icon="Lock" />}
              selected={false}
              minHeight={52}
              titleStyle={styles.rowTitle}
              onPress={() => handleInitialSecurityChoice('pin')}
            />
            <PickRow
              title={t('settings.loginSecurity.text4')}
              lead={<Disc icon="FingerprintPattern" />}
              selected={false}
              minHeight={52}
              titleStyle={styles.rowTitle}
              onPress={() => handleInitialSecurityChoice('biometric')}
            />
          </ListCard>
        </>
      )}

      {securityLoginSettings.isSecurityEnabled && (
        <>
          <SectionHeader title={t('settings.loginSecurity.text2')} first />
          <ListCard dividerInset={48}>
            <PickRow
              title={t('settings.loginSecurity.text3')}
              lead={<Disc icon="Lock" />}
              selected={securityLoginSettings.isPinEnabled}
              minHeight={52}
              titleStyle={styles.rowTitle}
              onPress={() => selectMethod(toggleLoginSecurity, 'pin')}
            />
            <PickRow
              title={t('settings.loginSecurity.text4')}
              lead={<Disc icon="FingerprintPattern" />}
              selected={securityLoginSettings.isBiometricEnabled}
              minHeight={52}
              titleStyle={styles.rowTitle}
              onPress={() => selectMethod(toggleLoginSecurity, 'biometric')}
            />
          </ListCard>

          {securityLoginSettings.isBiometricEnabled && (
            <View
              style={[styles.noteCard, { backgroundColor: tokens.surface }]}
            >
              <ThemeText
                styles={styles.noteTitle}
                content={t('settings.loginSecurity.biometricsHead')}
              />
              <ThemeText
                styles={[styles.noteBody, { color: tokens.muted }]}
                content={t('settings.loginSecurity.biometricsSubHead')}
              />
            </View>
          )}

          {securityLoginSettings.isPinEnabled && (
            <View style={styles.cardSpacing}>
              <ListCard>
                <ListRow
                  title={t('settings.loginSecurity.randomPinKeyboardToggle')}
                  sub={t('settings.loginSecurity.randomPinKeyboardSubtitle')}
                  minHeight={60}
                  paddingVertical={8}
                  titleStyle={styles.rowTitle}
                  subStyle={styles.rowSub}
                  trailing="switch"
                  value={useRandomPinLayout}
                  onPress={toggleUseRandomPinLayout}
                />
              </ListCard>
            </View>
          )}
        </>
      )}
    </CustomScrollView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 40,
  },
  firstCard: {
    marginTop: 16,
  },
  rowTitle: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  rowSub: {
    fontFamily: FONT.Title_Regular,
    fontSize: 13,
    lineHeight: 19,
  },
  noteCard: {
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
  },
  noteTitle: {
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
  noteBody: {
    marginTop: 6,
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
  },
  cardSpacing: {
    marginTop: 16,
  },
  detailCard: {
    width: '100%',
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
  },
  stepBlock: {
    width: '100%',
    marginTop: 16,
  },
  stepText: {
    marginBottom: 12,
  },
  stepButton: {
    marginTop: 16,
  },
  backText: {
    fontSize: 15,
    lineHeight: 22,
  },
  webErrorText: {
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
