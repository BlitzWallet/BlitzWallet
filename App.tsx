/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, {
  JSX,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { registerRootComponent } from 'expo';
import {
  getLocalStorageItem,
  retrieveData,
  setLocalStorageItem,
  removeLocalStorageItem,
} from './app/functions';

import {
  AdminLogin,
  ConnectingToNodeLoadingScreen,
} from './app/screens/inAccount';

import { GlobalContextProvider } from './context-store/context';

import { WebViewProvider } from './context-store/webViewContext';
import { Linking, Platform, NativeModules } from 'react-native';

import SplashScreen from './app/screens/splashScreen';
import { GlobalContactsList } from './context-store/globalContacts';

// import {GlobaleCashVariables} from './context-store/eCash';
import { ChooseLangugaePage } from './app/screens/createAccount';
import { GlobalAppDataProvider } from './context-store/appData';
import { PushNotificationProvider } from './context-store/notificationManager';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import GetThemeColors from './app/hooks/themeColors';
import {
  BLITZ_PAYMENT_DEEP_LINK_SCHEMES,
  CONTACT_UNIVERSAL_LINK_REGEX,
  GIFT_DEEPLINK_REGEX,
  LOGIN_SECUITY_MODE_KEY,
  LOGIN_SECURITY_MODE_TYPE_KEY,
} from './app/constants';
import { LiquidEventProvider } from './context-store/liquidEventContext';
import {
  LiquidNavigationListener,
  RootstockNavigationListener,
  // EcashNavigationListener,
  // LightningNavigationListener,
  // LiquidNavigationListener,
  SparkNavigationListener,
} from './context-store/SDKNavigation';
// import {LightningEventProvider} from './context-store/lightningEventContext';
import {
  GlobalThemeProvider,
  useGlobalThemeContext,
} from './context-store/theme';
import { GLobalNodeContextProider } from './context-store/nodeContext';
import { AppStatusProvider, useAppStatus } from './context-store/appStatus';
import { KeysContextProvider, useKeysContext } from './context-store/keys';
import { POSTransactionsProvider } from './context-store/pos';
import {
  FADE_SCREENS,
  FADE_TRANSPARENT_MODAL_SCREENS,
  SLIDE_FROM_BOTTOM_SCREENS,
  SLIDE_FROM_RIGHT_SCREENS,
} from './navigation/screens';
import getDeepLinkUser from './app/components/admin/homeComponents/contacts/internalComponents/getDeepLinkUser';
import { navigationRef } from './navigation/navigationService';
// import {GlobalConbinedTxContextProvider} from './context-store/combinedTransactionsContext';
// import BreezTest from './app/screens/breezTest';
import { ImageCacheProvider } from './context-store/imageCache';
import {
  runPinAndMnemoicMigration,
  runSecureStoreMigrationV2,
} from './app/functions/secureStore';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import HandleLNURLPayments from './context-store/lnurl';
// import {SparkConnectionListener} from './context-store/connectToNode';
import { SparkWalletProvider } from './context-store/sparkContext';
import { DropdownProvider } from './context-store/dropdownContext';

// let setStatusBarBackgroundColor: ((color: string) => void) | undefined;
// let setStatusBarStyle: ((style: 'light' | 'dark') => void) | undefined;
// let SystemUI: any;
// let NavigationBar: any;

// if (Platform.OS === 'android') {
//   const statusBar = require('expo-status-bar');
//   setStatusBarBackgroundColor = statusBar.setStatusBarBackgroundColor;
//   setStatusBarStyle = statusBar.setStatusBarStyle;
//   SystemUI = require('expo-system-ui');
//   NavigationBar = require('expo-navigation-bar');
// }
import * as ExpoSplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import {
  setStatusBarBackgroundColor,
  setStatusBarStyle,
} from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { InsetsProvider } from './context-store/insetsProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastContainer, ToastProvider } from './context-store/toastManager';
import { RootstockSwapProvider } from './context-store/rootstockSwapContext';
import { SparkConnectionManager } from './context-store/sparkConnection';
import { GlobalNostrWalletConnectProvider } from './context-store/NWC';
import { GlobalServerTimeProvider } from './context-store/serverTime';
import { AuthStatusProvider } from './context-store/authContext';
import { ActiveCustodyAccountProvider } from './context-store/activeAccount';
import { GiftProvider } from './context-store/giftContext';
import { UserBalanceProvider } from './context-store/userBalanceContext';
import { FlashnetProvider } from './context-store/flashnetContext';
import { LendaswapProvider } from './context-store/lendaSapContext';
// import { LRC20EventProvider } from './context-store/lrc20Listener';
import { useTranslation } from 'react-i18next';
import { isMoreThan40MinOld } from './app/functions/rotateAddressDateChecker';
import { AsyncStorageAdapter } from './app/functions/lendaswap/asyncStorageAdapter';
const DeepLinkIntentModule = NativeModules.DeepLinkIntentModule;
const Stack = createNativeStackNavigator();
// will unhide splashscreen when showing dynamic loading in splashscreen component
ExpoSplashScreen.preventAutoHideAsync()
  .then(result =>
    console.log(`SplashScreen.preventAutoHideAsync() succeeded: ${result}`),
  )
  .catch(console.warn);

function App(): JSX.Element {
  const storageAdapter = AsyncStorageAdapter.open();
  const config = {
    apiUrl: 'https://apilendaswap.lendasat.com',
    network: 'bitcoin', // or 'testnet'
    arkadeUrl: 'https://arkade.computer',
    esploraUrl: 'https://mempool.space/api',
    mnemonic: null, // Will generate new if not provided
    storageAdapter,
  };

  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <InsetsProvider>
          <KeyboardProvider>
            <ToastProvider>
              <GlobalThemeProvider>
                <DropdownProvider>
                  <AppStatusProvider>
                    <AuthStatusProvider>
                      <KeysContextProvider>
                        <GlobalContactsList>
                          <GlobalContextProvider>
                            <ActiveCustodyAccountProvider>
                              <WebViewProvider>
                                {/* <GlobaleCashVariables> */}
                                <SparkWalletProvider>
                                  <GLobalNodeContextProider>
                                    {/* <GlobalConbinedTxContextProvider> */}
                                    <GlobalAppDataProvider>
                                      <POSTransactionsProvider>
                                        <PushNotificationProvider>
                                          <LiquidEventProvider>
                                            <RootstockSwapProvider>
                                              {/* <LRC20EventProvider> */}
                                              <GlobalNostrWalletConnectProvider>
                                                {/* <LightningEventProvider> */}
                                                <ImageCacheProvider>
                                                  <GlobalServerTimeProvider>
                                                    <GiftProvider>
                                                      <FlashnetProvider>
                                                        <UserBalanceProvider>
                                                          <LendaswapProvider
                                                            config={config}
                                                          >
                                                            {/* <Suspense
                    fallback={<FullLoadingScreen text={'Loading Page'} />}> */}
                                                            <ResetStack />
                                                          </LendaswapProvider>
                                                        </UserBalanceProvider>
                                                      </FlashnetProvider>
                                                    </GiftProvider>
                                                    {/* </Suspense> */}
                                                  </GlobalServerTimeProvider>
                                                </ImageCacheProvider>
                                                {/* </LightningEventProvider> */}
                                              </GlobalNostrWalletConnectProvider>
                                              {/* </LRC20EventProvider> */}
                                            </RootstockSwapProvider>
                                          </LiquidEventProvider>
                                        </PushNotificationProvider>
                                      </POSTransactionsProvider>
                                    </GlobalAppDataProvider>
                                    {/* <BreezTest /> */}
                                    {/* </GlobalConbinedTxContextProvider> */}
                                  </GLobalNodeContextProider>
                                </SparkWalletProvider>
                                {/* </GlobaleCashVariables> */}
                              </WebViewProvider>
                            </ActiveCustodyAccountProvider>
                          </GlobalContextProvider>
                        </GlobalContactsList>
                      </KeysContextProvider>
                    </AuthStatusProvider>
                  </AppStatusProvider>
                </DropdownProvider>
              </GlobalThemeProvider>
            </ToastProvider>
          </KeyboardProvider>
        </InsetsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ResetStack(): JSX.Element | null {
  const [initSettings, setInitSettings] = useState<{
    isLoggedIn: boolean | null;
    hasSecurityEnabled: boolean | null;
    isLoaded: boolean | null;
  }>({
    isLoggedIn: null,
    hasSecurityEnabled: null,
    isLoaded: null,
  });
  const [securitySettings, setSecuritySettings] = useState<any>(null);
  const [pendingLinkData, setPendingLinkData] = useState<{
    url: string;
    timestamp: number | null;
  }>({
    url: '',
    timestamp: null,
  });
  const { theme, darkModeType } = useGlobalThemeContext();
  const { didGetToHomepage, appState } = useAppStatus();
  const { publicKey, setAccountMnemonic } = useKeysContext();
  const didInitializeSettings = useRef(false);
  const { backgroundColor } = GetThemeColors();
  const { i18n } = useTranslation();

  const handleDeepLink = useCallback(
    async (event: { url: string }, isInitialLoad = false) => {
      console.log(event);
      const { url } = event;
      try {
        if (isInitialLoad) {
          const savedDeepLink = await getLocalStorageItem(
            'lastHandledDeepLink',
          );
          const parsedSavedDeeplink = JSON.parse(savedDeepLink) || {
            url: '',
            dateAdded: null,
          };

          if (
            Platform.OS === 'android' &&
            DeepLinkIntentModule &&
            DeepLinkIntentModule.clearIntent
          ) {
            DeepLinkIntentModule.clearIntent();
          }

          if (parsedSavedDeeplink.url === url) {
            console.log('Deep link already handled:', url);
            return;
          }

          await setLocalStorageItem(
            'lastHandledDeepLink',
            JSON.stringify({ url: url, dateAdded: Date.now() }),
          );
        }

        console.log('Deep link URL:', url);
        const linkData = {
          url: event.url,
          timestamp: Date.now(),
        };

        setPendingLinkData(linkData);
        await setLocalStorageItem(
          'pendingDeepLinkData',
          JSON.stringify(linkData),
        );
        console.log('Stored pending link in state AND AsyncStorage');
      } catch (error) {
        console.error('Error handling deep link:', error);
      }
    },
    [setPendingLinkData],
  );

  const clearDeepLink = useCallback(async () => {
    setPendingLinkData({
      url: '',
      timestamp: null,
    });
    await removeLocalStorageItem('pendingDeepLinkData');
  }, []);

  const getInitialURL = useCallback(async () => {
    const url = await Linking.getInitialURL();
    if (url) {
      handleDeepLink({ url }, true);
      console.log('Initial deep link stored:', url);
    }
  }, [handleDeepLink]);

  const setNavigationBar = useCallback(async () => {
    if (appState === 'active') {
      try {
        if (Platform.OS === 'android') {
          await NavigationBar.setBackgroundColorAsync(backgroundColor);
          await NavigationBar.setButtonStyleAsync(theme ? 'light' : 'dark');
          setStatusBarBackgroundColor(backgroundColor, false);
          setStatusBarStyle(theme ? 'light' : 'dark', false);
        }
        await SystemUI.setBackgroundColorAsync(backgroundColor);
      } catch (error) {
        console.warn('Failed to set navigation bar:', error);
      }
    }
  }, [backgroundColor, theme, appState]);

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;
    let cancelled = false;

    debounceTimer = setTimeout(async () => {
      if (cancelled) return;

      const { url, timestamp } = pendingLinkData;
      if (!url) return;
      if (!navigationRef.current) return;

      if (appState !== 'active') return;

      if (!didGetToHomepage || !publicKey) return;

      try {
        // Convert URL to lowercase for case-insensitive checks
        const lowerUrl = url.toLowerCase();
        const contactSchemePrefix = 'blitz-wallet:';

        console.log(
          'Processing link:',
          url,
          'at timestamp:',
          timestamp,
          'conditions:',
          {
            didGetToHomepage,
            hasNavigationRef: !!navigationRef.current,
            hasPublicKey: !!publicKey,
          },
        );
        const blockSoftReset =
          (navigationRef.getRootState().routes[0]?.name === 'Home' &&
            navigationRef.getRootState().routes.length === 1) ||
          navigationRef.getRootState().routes[0]?.name === 'Splash';

        if (!blockSoftReset) {
          let isContactLink = false;

          if (GIFT_DEEPLINK_REGEX.test(url)) {
            navigationRef.current.navigate('CustomHalfModal', {
              wantedContent: 'ClaimGiftScreen',
              url,
              sliderHight: 0.6,
              claimType: 'claim',
            });
          } else {
            if (CONTACT_UNIVERSAL_LINK_REGEX.test(url)) {
              isContactLink = true;
            }

            if (lowerUrl.startsWith(contactSchemePrefix)) {
              // If the URL starts with the contact scheme, check if it contains a wrapped payment scheme.
              const contentAfterScheme = lowerUrl.substring(
                contactSchemePrefix.length,
              );

              const isWrappedPaymentLink = BLITZ_PAYMENT_DEEP_LINK_SCHEMES.some(
                scheme =>
                  // Check if the content starts with "scheme:" (e.g., "lightning:")
                  contentAfterScheme.startsWith(scheme + ':'),
              );

              isContactLink = !isWrappedPaymentLink;
            }

            if (isContactLink) {
              // Logic for handling contact deep links
              const deepLinkContact = await getDeepLinkUser({
                deepLinkContent: url,
                userProfile: { uuid: publicKey },
              });

              if (deepLinkContact.didWork) {
                navigationRef.current.navigate('ExpandedAddContactsPage', {
                  newContact: deepLinkContact.data,
                });
              } else {
                navigationRef.current.navigate('ErrorScreen', {
                  errorMessage: deepLinkContact.reason,
                  useTranslationString: true,
                });
              }
            } else {
              // Regex to strip 'blitz-wallet:' OR 'blitz:' prefix if it exists.
              // This ensures only the core payment URI is passed to the ConfirmPaymentScreen.
              const paymentUrl = url.replace(/^(blitz-wallet|blitz):/i, '');
              navigationRef.current.navigate('ConfirmPaymentScreen', {
                btcAdress: paymentUrl,
              });
            }
          }

          // Clear the pending link after successful processing
          await clearDeepLink();
        }
      } catch (err) {
        console.error('Error processing deep link:', err);
        navigationRef.current.navigate('ErrorScreen', {
          errorMessage: 'errormessages.processingDeepLinkError',
          useTranslationString: true,
        });

        // Clear the pending link even if there was an error
        await clearDeepLink();
      }
    }, 700);

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [pendingLinkData, appState, didGetToHomepage, publicKey, clearDeepLink]);

  useEffect(() => {
    async function loadPendingDeepLink() {
      try {
        const stored = await getLocalStorageItem('pendingDeepLinkData');
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log('Loaded pending deep link from AsyncStorage:', parsed);
          setPendingLinkData(parsed);
        }
      } catch (error) {
        console.error('Error loading pending deep link:', error);
      }
    }
    loadPendingDeepLink();
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, [handleDeepLink]);

  useEffect(() => {
    async function initWallet() {
      await runPinAndMnemoicMigration();
      await runSecureStoreMigrationV2();
      const [
        initialURL,
        loginModeType,
        pin,
        mnemonic,
        securitySettings,
        userSelectedLanguage,
      ] = await Promise.all([
        getInitialURL(),
        retrieveData(LOGIN_SECURITY_MODE_TYPE_KEY),
        retrieveData('pinHash'),
        retrieveData('encryptedMnemonic'),
        getLocalStorageItem(LOGIN_SECUITY_MODE_KEY),
        getLocalStorageItem('userSelectedLanguage').then(data =>
          JSON.parse(data),
        ),
      ]);

      const storedSettings = JSON.parse(securitySettings);

      const isPinFromMode = loginModeType?.value === 'pin';
      const isBiometricFromMode = loginModeType?.value === 'biometric';

      const parsedSettings = storedSettings ?? {
        isSecurityEnabled: true,
        isPinEnabled: isPinFromMode || (!isPinFromMode && !isBiometricFromMode),
        isBiometricEnabled: isBiometricFromMode,
      };
      if (!storedSettings)
        setLocalStorageItem(
          LOGIN_SECUITY_MODE_KEY,
          JSON.stringify(parsedSettings),
        );

      if (mnemonic.value && !parsedSettings.isSecurityEnabled) {
        setAccountMnemonic(mnemonic.value);
      }

      setSecuritySettings(parsedSettings);
      setInitSettings(prev => {
        return {
          ...prev,
          isLoggedIn: !!pin.value && !!mnemonic.value,
          hasSecurityEnabled: parsedSettings.isSecurityEnabled,
        };
      });

      i18n.changeLanguage(userSelectedLanguage);
    }

    if (appState === 'background') return;

    if (!didInitializeSettings.current) {
      didInitializeSettings.current = true;
      initWallet();
    } else {
      // Re-check login status when app becomes active again
      async function recheckLoginStatus() {
        const [pin, mnemonic, securitySettings] = await Promise.all([
          retrieveData('pinHash'),
          retrieveData('encryptedMnemonic'),
          getLocalStorageItem(LOGIN_SECUITY_MODE_KEY),
        ]);

        const storedSettings = JSON.parse(securitySettings);

        if (mnemonic.value && !storedSettings.isSecurityEnabled) {
          setAccountMnemonic(mnemonic.value);
        }

        setInitSettings(prev => {
          return {
            ...prev,
            isLoggedIn: !!pin.value && !!mnemonic.value,
            hasSecurityEnabled: storedSettings?.isSecurityEnabled ?? true,
          };
        });
      }

      recheckLoginStatus();
    }
  }, [appState]);

  const handleAnimationFinish = () => {
    setInitSettings(prev => {
      return { ...prev, isLoaded: true };
    });
  };
  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      dark: theme,
      colors: {
        ...DefaultTheme.colors,
        primary: '#1E1E1E',
        background: backgroundColor,
        card: '#1E1E1E',
        text: '#1E1E1E',
        border: '#1E1E1E',
        notification: '#1E1E1E',
      },
    }),
    [theme, backgroundColor],
  );

  useEffect(() => {
    if (appState === 'background') return;
    setNavigationBar();
  }, [backgroundColor, theme, appState]);

  const screenOptions = useMemo(() => {
    return {
      headerShown: false,
    };
  }, []);

  const HomeComponent = useMemo(() => {
    if (initSettings.isLoggedIn) {
      return initSettings.hasSecurityEnabled
        ? AdminLogin
        : ConnectingToNodeLoadingScreen;
    }
    return ChooseLangugaePage;
  }, [initSettings.isLoggedIn, initSettings.hasSecurityEnabled]);

  if (theme === null || darkModeType === null) {
    return null;
  }

  if (appState === 'background' && !didInitializeSettings.current) return null;

  return (
    <NavigationContainer theme={navigationTheme} ref={navigationRef}>
      {/* <StatusBar style={theme ? 'light' : 'dark'} translucent={true} /> */}
      <HandleLNURLPayments />
      <SparkNavigationListener />
      <RootstockNavigationListener />
      <LiquidNavigationListener />
      <ToastContainer />
      <SparkConnectionManager />
      {/* <EcashNavigationListener /> */}
      {/* <SparkConnectionListener /> */}
      {/* <LiquidNavigationListener /> */}
      {/* <LightningNavigationListener /> */}
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ animation: 'fade', gestureEnabled: false }}
          // initialParams={{ onAnimationFinish: handleAnimationFinish }}
        />
        <Stack.Screen
          name="Home"
          component={HomeComponent}
          initialParams={securitySettings}
          options={{
            animation: 'fade',
            gestureEnabled: false,
            contentStyle: {
              backgroundColor: backgroundColor,
              backfaceVisibility: 'hidden',
            },
          }}
        />
        <Stack.Screen
          name="ConnectingToNodeLoadingScreen"
          component={ConnectingToNodeLoadingScreen}
          options={{
            gestureEnabled: false,
            animation: 'fade',
            contentStyle: {
              backgroundColor: backgroundColor,
              backfaceVisibility: 'hidden',
            },
          }}
        />

        <Stack.Group
          screenOptions={{
            presentation: 'containedTransparentModal',
            animation: 'slide_from_bottom',
          }}
        >
          {SLIDE_FROM_BOTTOM_SCREENS.map(({ name, component: Component }) => (
            <Stack.Screen
              key={name}
              name={name}
              component={Component as React.ComponentType<any>}
            />
          ))}
        </Stack.Group>
        <Stack.Group
          screenOptions={{
            animation: 'slide_from_right',
          }}
        >
          {SLIDE_FROM_RIGHT_SCREENS.map(
            ({ name, component: Component, options = {} }) => (
              <Stack.Screen
                key={name}
                name={name}
                component={Component as React.ComponentType<any>}
                options={{ ...options }}
              />
            ),
          )}
        </Stack.Group>
        <Stack.Group
          screenOptions={{
            animation: 'fade',
            presentation: 'containedTransparentModal',
          }}
        >
          {FADE_SCREENS.map(({ name, component: Component, options = {} }) => (
            <Stack.Screen
              key={name}
              name={name}
              options={{ ...options }}
              component={Component as React.ComponentType<any>}
            />
          ))}
        </Stack.Group>
        <Stack.Group
          screenOptions={{
            animation: 'fade',
            presentation: 'transparentModal',
          }}
        >
          {FADE_TRANSPARENT_MODAL_SCREENS.map(
            ({ name, component: Component }) => (
              <Stack.Screen
                key={name}
                name={name}
                component={Component as React.ComponentType<any>}
              />
            ),
          )}
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
registerRootComponent(App);
