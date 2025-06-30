/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import {DefaultTheme, NavigationContainer} from '@react-navigation/native';
import './pollyfills';
import './i18n'; // for translation option
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React, {
  JSX,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {registerRootComponent} from 'expo';
import {
  getLocalStorageItem,
  retrieveData,
  setLocalStorageItem,
} from './app/functions';

import {
  AdminLogin,
  ConnectingToNodeLoadingScreen,
} from './app/screens/inAccount';

import {GlobalContextProvider} from './context-store/context';

import {WebViewProvider} from './context-store/webViewContext';
import {Linking, Platform} from 'react-native';

import SplashScreen from './app/screens/splashScreen';
import {GlobalContactsList} from './context-store/globalContacts';

import {GlobaleCashVariables} from './context-store/eCash';
import {CreateAccountHome} from './app/screens/createAccount';
import {GlobalAppDataProvider} from './context-store/appData';
import PushNotificationManager, {
  registerBackgroundNotificationTask,
} from './context-store/notificationManager';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import GetThemeColors from './app/hooks/themeColors';
import {COLORS, LOGIN_SECUITY_MODE_KEY} from './app/constants';
import {LiquidEventProvider} from './context-store/liquidEventContext';
import {
  EcashNavigationListener,
  // LightningNavigationListener,
  // LiquidNavigationListener,
  SparkNavigationListener,
} from './context-store/SDKNavigation';
// import {LightningEventProvider} from './context-store/lightningEventContext';
import {
  GlobalThemeProvider,
  useGlobalThemeContext,
} from './context-store/theme';
import {GLobalNodeContextProider} from './context-store/nodeContext';
import {AppStatusProvider, useAppStatus} from './context-store/appStatus';
import {KeysContextProvider, useKeysContext} from './context-store/keys';
import {POSTransactionsProvider} from './context-store/pos';
import {
  FADE_SCREENS,
  FADE_TRANSPARENT_MODAL_SCREENS,
  SLIDE_FROM_BOTTOM_SCREENS,
  SLIDE_FROM_RIGHT_SCREENS,
} from './navigation/screens';
import getDeepLinkUser from './app/components/admin/homeComponents/contacts/internalComponents/getDeepLinkUser';
import {navigationRef} from './navigation/navigationService';
// import {GlobalConbinedTxContextProvider} from './context-store/combinedTransactionsContext';
// import BreezTest from './app/screens/breezTest';
import {ImageCacheProvider} from './context-store/imageCache';
import {
  runPinAndMnemoicMigration,
  runSecureStoreMigrationV2,
} from './app/functions/secureStore';
import {KeyboardProvider} from 'react-native-keyboard-controller';
import HandleLNURLPayments from './context-store/lnurl';
import {SparkConnectionListener} from './context-store/connectToNode';
import {SparkWalletProvider} from './context-store/sparkContext';
import * as NavigationBar from 'expo-navigation-bar';
import {setStatusBarBackgroundColor, setStatusBarStyle} from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import {InsetsProvider} from './context-store/insetsProvider';
import {SafeAreaProvider} from 'react-native-safe-area-context';

const Stack = createNativeStackNavigator();

function App(): JSX.Element {
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <InsetsProvider>
          <KeyboardProvider>
            <KeysContextProvider>
              <GlobalContactsList>
                <GlobalContextProvider>
                  <AppStatusProvider>
                    <GlobalThemeProvider>
                      <GlobaleCashVariables>
                        <GLobalNodeContextProider>
                          <SparkWalletProvider>
                            {/* <GlobalConbinedTxContextProvider> */}
                            <GlobalAppDataProvider>
                              <POSTransactionsProvider>
                                <WebViewProvider>
                                  <PushNotificationManager>
                                    <LiquidEventProvider>
                                      {/* <LightningEventProvider> */}
                                      <ImageCacheProvider>
                                        {/* <Suspense
                    fallback={<FullLoadingScreen text={'Loading Page'} />}> */}
                                        <ResetStack />
                                        {/* </Suspense> */}
                                      </ImageCacheProvider>
                                      {/* </LightningEventProvider> */}
                                    </LiquidEventProvider>
                                  </PushNotificationManager>
                                </WebViewProvider>
                              </POSTransactionsProvider>
                            </GlobalAppDataProvider>
                            {/* <BreezTest /> */}
                            {/* </GlobalConbinedTxContextProvider> */}
                          </SparkWalletProvider>
                        </GLobalNodeContextProider>
                      </GlobaleCashVariables>
                    </GlobalThemeProvider>
                  </AppStatusProvider>
                </GlobalContextProvider>
              </GlobalContactsList>
            </KeysContextProvider>
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
  const [pendingLinkData, setPendingLinkData] = useState<{
    url: string;
    timestamp: number | null;
  }>({
    url: '',
    timestamp: null,
  });
  const {theme, darkModeType} = useGlobalThemeContext();
  const {didGetToHomepage} = useAppStatus();
  const {publicKey, setAccountMnemonic} = useKeysContext();
  const {backgroundColor} = GetThemeColors();

  // Memoize handleDeepLink
  const handleDeepLink = useCallback(
    (event: {url: string}) => {
      console.log('TEST');
      const {url} = event;
      console.log('Deep link URL:', url);

      setPendingLinkData({
        url: event.url,
        timestamp: Date.now(),
      });
    },
    [didGetToHomepage],
  );

  const clearDeepLink = useCallback(() => {
    setPendingLinkData({
      url: '',
      timestamp: null,
    });
  }, []);

  const getInitialURL = useCallback(async () => {
    const url = await Linking.getInitialURL();
    if (url) {
      handleDeepLink({url});
      console.log('Initial deep link stored:', url);
    }
  }, []);

  const setNavigationBar = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        await SystemUI.setBackgroundColorAsync(backgroundColor);
        await NavigationBar.setBackgroundColorAsync(backgroundColor);
        await NavigationBar.setButtonStyleAsync(theme ? 'light' : 'dark');
        setStatusBarBackgroundColor(backgroundColor);
        setStatusBarStyle(theme ? 'light' : 'dark');
      } catch (error) {
        console.warn('Failed to set navigation bar:', error);
      }
    }
  }, [backgroundColor, theme]);

  useEffect(() => {
    async function handleDeeplink() {
      const {url, timestamp} = pendingLinkData;
      if (!url) return;
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

      if (didGetToHomepage && navigationRef.current && publicKey) {
        try {
          if (url.startsWith('lightning')) {
            navigationRef.current.navigate('ConfirmPaymentScreen', {
              btcAdress: url,
            });
          } else if (url.includes('blitz')) {
            const deepLinkContact = await getDeepLinkUser({
              deepLinkContent: url,
              userProfile: {uuid: publicKey},
            });

            if (deepLinkContact.didWork) {
              navigationRef.current.navigate('ExpandedAddContactsPage', {
                newContact: deepLinkContact.data,
              });
            } else {
              navigationRef.current.navigate('ErrorScreen', {
                errorMessage: deepLinkContact.reason,
              });
            }
          }

          // Clear the pending link after processing
          clearDeepLink();
        } catch (error: any) {
          console.error('Error processing deep link:', error);
          navigationRef.current.navigate('ErrorScreen', {
            errorMessage: `Failed to process link: ${
              error.message || 'Unknown error'
            }`,
          });

          // Clear the pending link even if there was an error
          clearDeepLink();
        }
      }
    }
    handleDeeplink();
  }, [pendingLinkData, didGetToHomepage, publicKey]);

  useEffect(() => {
    async function initWallet() {
      await runPinAndMnemoicMigration();
      await runSecureStoreMigrationV2();
      const [initialURL, registerBackground, pin, mnemonic, securitySettings] =
        await Promise.all([
          getInitialURL(),
          registerBackgroundNotificationTask(),
          retrieveData('pinHash'),
          retrieveData('encryptedMnemonic'),
          getLocalStorageItem(LOGIN_SECUITY_MODE_KEY),
        ]);

      const storedSettings = JSON.parse(securitySettings);
      const parsedSettings = storedSettings ?? {
        isSecurityEnabled: true,
        isPinEnabled: true,
        isBiometricEnabled: false,
      };
      if (!storedSettings)
        setLocalStorageItem(
          LOGIN_SECUITY_MODE_KEY,
          JSON.stringify(parsedSettings),
        );

      if (mnemonic.value && !parsedSettings.isSecurityEnabled) {
        setAccountMnemonic(mnemonic.value);
      }

      setInitSettings(prev => {
        return {
          ...prev,
          isLoggedIn: !!pin.value && !!mnemonic.value,
          hasSecurityEnabled: parsedSettings.isSecurityEnabled,
        };
      });
    }
    const subscription = Linking.addEventListener('url', handleDeepLink);
    initWallet();

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAnimationFinish = () => {
    setInitSettings(prev => {
      return {...prev, isLoaded: true};
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
    setNavigationBar();
  }, [backgroundColor, theme]);

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
    return CreateAccountHome;
  }, [initSettings.isLoggedIn, initSettings.hasSecurityEnabled]);

  if (!initSettings.isLoaded || theme === null || darkModeType === null) {
    return <SplashScreen onAnimationFinish={handleAnimationFinish} />;
  }

  return (
    <NavigationContainer theme={navigationTheme} ref={navigationRef}>
      {/* <StatusBar style={theme ? 'light' : 'dark'} translucent={true} /> */}
      <HandleLNURLPayments />
      <SparkNavigationListener />
      <EcashNavigationListener />
      <SparkConnectionListener />
      {/* <LiquidNavigationListener /> */}
      {/* <LightningNavigationListener /> */}
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen
          name="Home"
          component={HomeComponent}
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
          }}>
          {SLIDE_FROM_BOTTOM_SCREENS.map(({name, component: Component}) => (
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
          }}>
          {SLIDE_FROM_RIGHT_SCREENS.map(
            ({name, component: Component, options = {}}) => (
              <Stack.Screen
                key={name}
                name={name}
                component={Component as React.ComponentType<any>}
                options={{...options}}
              />
            ),
          )}
        </Stack.Group>
        <Stack.Group
          screenOptions={{
            animation: 'fade',
            presentation: 'containedTransparentModal',
          }}>
          {FADE_SCREENS.map(({name, component: Component, options = {}}) => (
            <Stack.Screen
              key={name}
              name={name}
              options={{...options}}
              component={Component as React.ComponentType<any>}
            />
          ))}
        </Stack.Group>
        <Stack.Group
          screenOptions={{
            animation: 'fade',
            presentation: 'transparentModal',
          }}>
          {FADE_TRANSPARENT_MODAL_SCREENS.map(
            ({name, component: Component}) => (
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
