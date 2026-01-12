import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, AppState, Platform } from 'react-native';
import { COLORS, ICONS, SIZES } from '../../../constants';
import { Image } from 'expo-image';
import { ThemeText } from '../../../functions/CustomElements';
import CustomButton from '../../../functions/CustomElements/button';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import GetThemeColors from '../../../hooks/themeColors';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { retrieveData, storeData } from '../../../functions';
import {
  decryptMnemonicWithBiometrics,
  handleLoginSecuritySwitch,
} from '../../../functions/handleMnemonic';
import sha256Hash from '../../../functions/hash';
import { useKeysContext } from '../../../../context-store/keys';
import { useTranslation } from 'react-i18next';
import RNRestart from 'react-native-restart';
import factoryResetWallet from '../../../functions/factoryResetWallet';
import { useAppStatus } from '../../../../context-store/appStatus';

export default function BiometricsLogin() {
  const { appState, isAppFocused } = useAppStatus();
  const { t } = useTranslation();
  const { setAccountMnemonic } = useKeysContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();
  const navigate = useNavigation();
  const didNavigate = useRef(null);
  const numRetriesBiometric = useRef(0);
  const isInitialRender = useRef(true);
  const authTimeoutRef = useRef(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  const isFocused = useIsFocused();

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
        authTimeoutRef.current = null;
      }
    };
  }, []);

  // Handle focus changes with 500ms delay
  useEffect(() => {
    // Clear any existing timeout
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = null;
    }

    // Only proceed if app is active AND screen is focused AND Android focus events say we're focused
    const isFullyFocused = appState === 'active' && isFocused && isAppFocused;

    if (isFullyFocused) {
      console.log(
        'App fully focused (appState + isFocused + isAppFocused), starting 500ms timer...',
      );

      authTimeoutRef.current = setTimeout(() => {
        console.log('500ms elapsed, triggering authentication');
        loadPageInformation();
      }, 500);
    } else {
      console.log(
        'App not fully focused, canceling any pending authentication',
      );
    }

    // Cleanup timeout if dependencies change before 500ms
    return () => {
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
        authTimeoutRef.current = null;
      }
    };
  }, [appState, isFocused, isAppFocused]);

  async function loadPageInformation() {
    try {
      const [storedPin] = await Promise.all([retrieveData('pinHash')]);

      let needsToBeMigrated;
      try {
        JSON.parse(storedPin.value);
        needsToBeMigrated = true;
      } catch (err) {
        console.log('comparison value error', err);
        needsToBeMigrated = false;
      }

      if (needsToBeMigrated) {
        console.log('before login security switch');
        if (didNavigate.current) return;

        setIsAuthenticating(true);

        const savedMnemonic = await retrieveData('encryptedMnemonic');
        const migrationResponse = await handleLoginSecuritySwitch(
          savedMnemonic.value,
          '',
          'biometric',
        );
        console.log('after login security switch');

        if (migrationResponse) {
          storeData('pinHash', sha256Hash(storedPin.value));
          setAccountMnemonic(savedMnemonic.value);
          didNavigate.current = true;
          navigate.replace('ConnectingToNodeLoadingScreen');
        } else {
          setIsAuthenticating(false);
          navigate.navigate('ConfirmActionPage', {
            confirmMessage: t(
              'adminLogin.pinPage.isBiometricEnabledConfirmAction',
            ),
            confirmFunction: async () => {
              const deleted = await factoryResetWallet();
              if (deleted) {
                RNRestart.restart();
              } else {
                navigate.navigate('ErrorScreen', {
                  errorMessage: t('errormessages.deleteAccount'),
                });
              }
            },
          });
        }
        return;
      }

      handleFaceID();
    } catch (err) {
      console.log('Load pin page information error', err);
      setIsAuthenticating(false);
    }
  }

  const handleFaceID = async () => {
    if (isAuthenticating && !isInitialRender.current) {
      console.log('Already authenticating, ignoring duplicate call');
      return;
    }
    if (didNavigate.current) return;
    isInitialRender.current = false;

    try {
      if (numRetriesBiometric.current >= 3) {
        navigate.navigate('ConfirmActionPage', {
          confirmMessage: t(
            'adminLogin.pinPage.isBiometricEnabledConfirmAction',
          ),
          confirmFunction: async () => {
            const deleted = await factoryResetWallet();
            if (deleted) {
              RNRestart.restart();
            } else {
              navigate.navigate('ErrorScreen', {
                errorMessage: t('errormessages.deleteAccount'),
              });
            }
          },
          cancelFunction: () => {
            numRetriesBiometric.current = 0;
          },
        });
        return;
      }

      setIsAuthenticating(true);
      numRetriesBiometric.current++;

      console.log('Starting biometric authentication...');

      const decryptResponse = await decryptMnemonicWithBiometrics();

      if (decryptResponse) {
        setAccountMnemonic(decryptResponse);
        didNavigate.current = true;
        navigate.replace('ConnectingToNodeLoadingScreen');
      } else {
        setIsAuthenticating(false);
      }
    } catch (err) {
      console.log('error handling faceid', err);
      setIsAuthenticating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.centerContent}>
        <Image
          source={ICONS.logoIcon}
          style={[
            styles.logo,
            {
              tintColor: theme ? COLORS.darkModeText : undefined,
            },
          ]}
        />
      </View>

      <View style={styles.bottomSection}>
        <CustomButton
          actionFunction={handleFaceID}
          buttonStyles={[
            styles.faceIdButton,
            {
              backgroundColor:
                theme && darkModeType ? backgroundOffset : COLORS.primary,
              opacity: isAuthenticating ? 0.6 : 1,
            },
          ]}
          textStyles={{ color: COLORS.darkModeText }}
          textContent={t('adminLogin.pinPage.biometricsHeader')}
          disabled={isAuthenticating}
        />

        <ThemeText styles={styles.blitzText} content={'Blitz'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
  bottomSection: {
    alignItems: 'center',
  },
  faceIdButton: {
    borderRadius: 8,
    marginBottom: 20,
  },
  faceIdText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  blitzText: {
    fontSize: SIZES.xxLarge,
    opacity: 0.6,
  },
});
