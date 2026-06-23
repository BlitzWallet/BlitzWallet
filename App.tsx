/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { JSX, useCallback, useEffect, useMemo, useState } from 'react';
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

import { CreateAccountHome } from './app/screens/createAccount';
import { GlobalAppDataProvider } from './context-store/appData';
import { PushNotificationProvider } from './context-store/notificationManager';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import GetThemeColors from './app/hooks/themeColors';
import {
  BLITZ_PAYMENT_DEEP_LINK_SCHEMES,
  CONTACT_UNIVERSAL_LINK_REGEX,
  GIFT_DEEPLINK_REGEX,
  POOL_DEEPLINK_REGEX,
  PAYLINK_DEEPLINK_REGEX,
} from './app/constants';
import { LiquidEventProvider } from './context-store/liquidEventContext';
import {
  GlobalThemeProvider,
  useGlobalThemeContext,
} from './context-store/theme';
import { GLobalNodeContextProider } from './context-store/nodeContext';
import { AppStatusProvider, useAppStatus } from './context-store/appStatus';
import { KeysContextProvider, useKeysContext } from './context-store/keys';
import {
  FADE_SCREENS,
  // FADE_TRANSPARENT_MODAL_SCREENS,
  MODAL_CARD_SCREENS,
  SLIDE_FROM_BOTTOM_SCREENS,
  SLIDE_FROM_RIGHT_SCREENS,
} from './navigation/screens';
import getDeepLinkUser from './app/components/admin/homeComponents/contacts/internalComponents/getDeepLinkUser';
import { navigationRef } from './navigation/navigationService';
import { ImageCacheProvider } from './context-store/imageCache';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import HandleLNURLPayments from './context-store/lnurl';
import { SparkWalletProvider } from './context-store/sparkContext';
import { DropdownProvider } from './context-store/dropdownContext';
import * as ExpoSplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import {
  setStatusBarBackgroundColor,
  setStatusBarStyle,
} from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { InsetsProvider } from './context-store/insetsProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from './context-store/toastManager';
import { ToastContainer } from './context-store/toastContainer';
import { RootstockSwapProvider } from './context-store/rootstockSwapContext';
import { SparkConnectionManager } from './context-store/sparkConnection';
import { GlobalNostrWalletConnectProvider } from './context-store/NWC';
import { GlobalServerTimeProvider } from './context-store/serverTime';
import { AuthStatusProvider } from './context-store/authContext';
import { ActiveCustodyAccountProvider } from './context-store/activeAccount';
import { UserBalanceProvider } from './context-store/userBalanceContext';
import { FlashnetProvider } from './context-store/flashnetContext';
import { AnalyticsNumbersProvider } from './context-store/analyticsContext';
import { BTCMapProvider } from './context-store/btcMapContext';
import { SpendAndReplaceProvider } from './context-store/spendAndReplaceContext';
import { LoginProvider, useLoginContext } from './context-store/loginContext';
const DeepLinkIntentModule = NativeModules.DeepLinkIntentModule;
const Stack = createNativeStackNavigator();
// will unhide splashscreen when showing dynamic loading in splashscreen component
ExpoSplashScreen.preventAutoHideAsync()
  .then(result =>
    console.log(`SplashScreen.preventAutoHideAsync() succeeded: ${result}`),
  )
  .catch(console.warn);

function App(): JSX.Element {
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
                        <BTCMapProvider>
                          <GlobalContactsList>
                            <GlobalContextProvider>
                              <ActiveCustodyAccountProvider>
                                <WebViewProvider>
                                  <SparkWalletProvider>
                                    <GLobalNodeContextProider>
                                      <GlobalAppDataProvider>
                                        <PushNotificationProvider>
                                          <LiquidEventProvider>
                                            <RootstockSwapProvider>
                                              <GlobalNostrWalletConnectProvider>
                                                <ImageCacheProvider>
                                                  <GlobalServerTimeProvider>
                                                    <FlashnetProvider>
                                                      <UserBalanceProvider>
                                                        <AnalyticsNumbersProvider>
                                                          <SpendAndReplaceProvider>
                                                            <LoginProvider>
                                                              {/* <Suspense
                    fallback={<FullLoadingScreen text={'Loading Page'} />}> */}
                                                              <ResetStack />
                                                            </LoginProvider>
                                                          </SpendAndReplaceProvider>
                                                        </AnalyticsNumbersProvider>
                                                      </UserBalanceProvider>
                                                    </FlashnetProvider>
                                                    {/* </Suspense> */}
                                                  </GlobalServerTimeProvider>
                                                </ImageCacheProvider>
                                              </GlobalNostrWalletConnectProvider>
                                            </RootstockSwapProvider>
                                          </LiquidEventProvider>
                                        </PushNotificationProvider>
                                      </GlobalAppDataProvider>
                                    </GLobalNodeContextProider>
                                  </SparkWalletProvider>
                                </WebViewProvider>
                              </ActiveCustodyAccountProvider>
                            </GlobalContextProvider>
                          </GlobalContactsList>
                        </BTCMapProvider>
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
  const [pendingLinkData, setPendingLinkData] = useState<{
    url: string;
    timestamp: number | null;
  }>({
    url: '',
    timestamp: null,
  });
  const { theme, darkModeType } = useGlobalThemeContext();
  const { isLoaded, loginRoute } = useLoginContext();
  const { didGetToHomepage, appState } = useAppStatus();
  const { publicKey, setAccountMnemonic, accountMnemoinc } = useKeysContext();
  const { backgroundColor } = GetThemeColors();

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
        const rootState = navigationRef?.getRootState() ?? { routes: [] };
        const blockSoftReset =
          (rootState.routes[0]?.name === 'Home' &&
            rootState.routes.length === 1) ||
          rootState.routes[0]?.name === 'Splash';

        if (!blockSoftReset) {
          let isContactLink = false;

          if (PAYLINK_DEEPLINK_REGEX.test(url)) {
            const match = url.match(/paylink\/([A-Za-z0-9]{9})/i);
            if (match) {
              navigationRef.current.reset({
                index: 0,
                routes: [
                  {
                    name: 'HomeAdmin',
                    params: { screen: 'Home' },
                  },
                  {
                    name: 'ConfirmPaymentScreen',
                    params: {
                      btcAdress: `paylink://${match[1]}`,
                      fromPage: 'paylink',
                    },
                  },
                ],
              });
            }
          } else if (POOL_DEEPLINK_REGEX.test(url)) {
            const poolIdMatch = url.match(/pools\/([0-9a-f-]{36})/i);
            if (poolIdMatch) {
              navigationRef.current.navigate('PoolsStack', {
                screen: 'PoolDetailScreen',
                params: { poolId: poolIdMatch[1] },
              });
            }
          } else if (GIFT_DEEPLINK_REGEX.test(url)) {
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

  // Cold-start deep link: the launch URL is only available via getInitialURL().
  useEffect(() => {
    getInitialURL();
  }, [getInitialURL]);

  // Auto-enter accounts with login security disabled (NO_LOGIN). For the 'plain'
  // storage mode the stored mnemonic is plaintext, so set it directly and let
  // the loading screen take over. Re-runs whenever the mnemonic is cleared (e.g.
  // KeysContext wipes it on a long-background resume) so the user isn't stranded
  // on the loading screen after returning to the app.
  useEffect(() => {
    if (loginRoute !== 'NO_LOGIN') return;
    if (accountMnemoinc) return;
    let cancelled = false;
    (async () => {
      // This secure-store read is the only thing that logs a no-security user
      // in; a transient keychain failure here strands them on the loading
      // screen, so retry a few times with backoff before giving up.
      const MAX_ATTEMPTS = 5;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;
        const mnemonic = await retrieveData('encryptedMnemonic');
        if (cancelled) return;
        if (mnemonic.value) {
          setAccountMnemonic(mnemonic.value);
          return;
        }
        await new Promise(res => setTimeout(res, 300 * (attempt + 1)));
      }
      console.log('Failed to load NO_LOGIN mnemonic after retries');
    })();
    return () => {
      cancelled = true;
    };
  }, [loginRoute, accountMnemoinc, setAccountMnemonic]);

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
      keyboardHandlingEnabled: true,
    };
  }, []);

  const HomeComponent = useMemo(() => {
    if (loginRoute === 'NO_ACCOUNT') return CreateAccountHome;
    if (loginRoute === 'NO_LOGIN') return ConnectingToNodeLoadingScreen;
    return AdminLogin;
  }, [loginRoute]);

  if (theme === null || darkModeType === null || !isLoaded) {
    return null;
  }

  return (
    <NavigationContainer theme={navigationTheme} ref={navigationRef}>
      {/* <StatusBar style={theme ? 'light' : 'dark'} translucent={true} /> */}
      <HandleLNURLPayments />
      <ToastContainer />
      <SparkConnectionManager />
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen
          name="SplashReload"
          component={SplashScreen}
          options={{ animation: 'none', gestureEnabled: false }}
        />
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
            presentation: 'card',
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
        {/* <Stack.Group
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
        </Stack.Group> */}
        <Stack.Group
          screenOptions={{
            presentation: 'modal',
          }}
        >
          {MODAL_CARD_SCREENS.map(({ name, component: Component }) => (
            <Stack.Screen
              key={name}
              name={name}
              component={Component as React.ComponentType<any>}
            />
          ))}
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
registerRootComponent(App);
