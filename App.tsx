/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import {
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import 'text-encoding-polyfill';
import 'react-native-gesture-handler';
import './i18n'; // for translation option
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {registerRootComponent} from 'expo';
type RootStackParamList = {
  Home: {someParam?: string};
  Details: {someParam?: string};
};
import {
  getLocalStorageItem,
  retrieveData,
  setLocalStorageItem,
} from './app/functions';

import {
  AdminLogin,
  ConnectingToNodeLoadingScreen,
} from './app/screens/inAccount';

import {
  GlobalContextProvider,
  useGlobalContextProvider,
} from './context-store/context';

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
  LightningNavigationListener,
  LiquidNavigationListener,
} from './context-store/SDKNavigation';
import {LightningEventProvider} from './context-store/lightningEventContext';
import {
  GlobalThemeProvider,
  useGlobalThemeContext,
} from './context-store/theme';
import {GLobalNodeContextProider} from './context-store/nodeContext';
import {AppStatusProvider} from './context-store/appStatus';
import {KeysContextProvider} from './context-store/keys';
import {POSTransactionsProvider} from './context-store/pos';
import {
  FADE_SCREENS,
  FADE_TRANSPARENT_MODAL_SCREENS,
  SLIDE_FROM_BOTTOM_SCREENS,
  SLIDE_FROM_RIGHT_SCREENS,
} from './navigation/screens';

const Stack = createNativeStackNavigator();

function App(): JSX.Element {
  return (
    <GestureHandlerRootView>
      <KeysContextProvider>
        <AppStatusProvider>
          <GlobalThemeProvider>
            <GLobalNodeContextProider>
              <GlobalContextProvider>
                <GlobalAppDataProvider>
                  <POSTransactionsProvider>
                    <WebViewProvider>
                      <GlobalContactsList>
                        <GlobaleCashVariables>
                          <PushNotificationManager>
                            <LiquidEventProvider>
                              <LightningEventProvider>
                                {/* <Suspense
                    fallback={<FullLoadingScreen text={'Loading Page'} />}> */}
                                <ResetStack />
                                {/* </Suspense> */}
                              </LightningEventProvider>
                            </LiquidEventProvider>
                          </PushNotificationManager>
                        </GlobaleCashVariables>
                      </GlobalContactsList>
                    </WebViewProvider>
                  </POSTransactionsProvider>
                </GlobalAppDataProvider>
                {/* <BreezTest /> */}
              </GlobalContextProvider>
            </GLobalNodeContextProider>
          </GlobalThemeProvider>
        </AppStatusProvider>
      </KeysContextProvider>
    </GestureHandlerRootView>
  );
}

function ResetStack(): JSX.Element | null {
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList> | null>(null);

  const [initSettings, setInitSettings] = useState<{
    isLoggedIn: boolean | null;
    hasSecurityEnabled: boolean | null;
    isLoaded: boolean | null;
  }>({
    isLoggedIn: null,
    hasSecurityEnabled: null,
    isLoaded: null,
  });
  const {theme, darkModeType} = useGlobalThemeContext();
  const {setDeepLinkContent} = useGlobalContextProvider();
  const {backgroundColor} = GetThemeColors();

  // Memoize handleDeepLink
  // const handleDeepLink = useCallback((event: {url: string}) => {
  //   console.log('TEST');
  //   const {url} = event;

  //   if (url.startsWith('lightning')) {
  //     setDeepLinkContent({type: 'LN', data: url});
  //   } else if (url.includes('blitz')) {
  //     setDeepLinkContent({type: 'Contact', data: url});
  //   }

  //   console.log('Deep link URL:', url); // Log the URL
  // }, []);

  // Memoize getInitialURL
  // const getInitialURL = useCallback(async () => {
  //   const url = await Linking.getInitialURL();
  //   if (url) {
  //     handleDeepLink({url});
  //   }
  // }, [handleDeepLink]);

  useEffect(() => {
    // const subscription = Linking.addListener('url', handleDeepLink);

    async function initWallet() {
      const [
        //initialURL,
        registerBackground,
        pin,
        mnemonic,
        securitySettings,
      ] = await Promise.all([
        // await getInitialURL(),
        await registerBackgroundNotificationTask(),
        await retrieveData('pin'),
        await retrieveData('mnemonic'),
        await getLocalStorageItem(LOGIN_SECUITY_MODE_KEY),
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

      setInitSettings(prev => {
        return {
          ...prev,
          isLoggedIn: pin && mnemonic,
          hasSecurityEnabled: parsedSettings.isSecurityEnabled,
        };
      });
    }
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
      dark: theme,
      colors: {
        background: backgroundColor,
        primary: '',
        card: '',
        text: '',
        border: '',
        notification: '',
      },
    }),
    [theme, backgroundColor],
  );

  const screenOptions = useMemo(() => {
    return {
      headerShown: false,
      statusBarColor: Platform.OS === 'android' ? backgroundColor : undefined,
      statusBarStyle:
        Platform.OS === 'android'
          ? ((theme ? 'light' : 'dark') as
              | 'light'
              | 'dark'
              | 'inverted'
              | 'auto'
              | undefined)
          : undefined,
      statusBarAnimation:
        Platform.OS === 'android'
          ? ('fade' as 'fade' | 'none' | 'slide' | undefined)
          : undefined,
      navigationBarColor: backgroundColor,
    };
  }, [backgroundColor, theme]);

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
      <LiquidNavigationListener />
      <LightningNavigationListener />
      <EcashNavigationListener />
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
          {SLIDE_FROM_BOTTOM_SCREENS.map(({name, component}) => (
            <Stack.Screen key={name} name={name} component={component} />
          ))}
        </Stack.Group>
        <Stack.Group
          screenOptions={{
            animation: 'slide_from_right',
          }}>
          {SLIDE_FROM_RIGHT_SCREENS.map(({name, component, options = {}}) => (
            <Stack.Screen
              key={name}
              name={name}
              component={component}
              options={{...options}}
            />
          ))}
        </Stack.Group>
        <Stack.Group
          screenOptions={{
            animation: 'fade',
            presentation: 'containedTransparentModal',
          }}>
          {FADE_SCREENS.map(({name, component, options = {}}) => (
            <Stack.Screen
              key={name}
              name={name}
              options={{...options}}
              component={component}
            />
          ))}
        </Stack.Group>
        <Stack.Group
          screenOptions={{
            animation: 'fade',
            presentation: 'transparentModal',
          }}>
          {FADE_TRANSPARENT_MODAL_SCREENS.map(({name, component}) => (
            <Stack.Screen key={name} name={name} component={component} />
          ))}
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
registerRootComponent(App);
