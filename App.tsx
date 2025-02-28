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
import React, {Suspense, useCallback, useEffect, useRef, useState} from 'react';
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
// import SplashScreen from 'react-native-splash-screen';

// const DislaimerPage = lazy(
//   () => import('./app/screens/createAccount/disclaimer.js'),
// );
// const GenerateKey = lazy(
//   () => import('./app/screens/createAccount/keySetup/generateKey.js'),
// );
// const PinSetupPage = lazy(
//   () => import('./app/screens/createAccount/keySetup/pin.js'),
// );
// const RestoreWallet = lazy(
//   () => import('./app/screens/createAccount/restoreWallet/home.js'),
// );
// const SkipCreateAccountPathMessage = lazy(
//   () => import('./app/screens/createAccount/skipMessage.js'),
// );

// in account pages

// const AdminLogin = lazy(() => import('./app/screens/inAccount/login.js'));
// const AppStorePageIndex = lazy(
//   () => import('./app/screens/inAccount/appStorePageIndex.js'),
// );
// const ConfirmTxPage = lazy(
//   () => import('./app/screens/inAccount/confirmTxPage.js'),
// );
// const ConnectingToNodeLoadingScreen = lazy(
//   () => import('./app/screens/inAccount/loadingScreen.js'),
// );
// const ConnectionToNode = lazy(() =>
//   import('./app/screens/inAccount/conectionToNode.js').then(module => ({
//     default: module['ConnectionToNode'],
//   })),
// );
// const ExpandedTx = lazy(
//   () => import('./app/screens/inAccount/expandedTxPage.js'),
// );
// const TechnicalTransactionDetails = lazy(
//   () => import('./app/screens/inAccount/technicalTransactionDetails.js'),
// );
// const ViewAllTxPage = lazy(
//   () => import('./app/screens/inAccount/viewAllTxPage.js'),
// );
// const SettingsContentIndex = lazy(
//   () => import('./app/screens/inAccount/settingsContent.js'),
// );

import {
  AdminHomeIndex,
  AdminLogin,
  AppStorePageIndex,
  ConfirmTxPage,
  ConnectingToNodeLoadingScreen,
  ConnectionToNode,
  ExpandedTx,
  ReceivePaymentHome,
  SendPaymentHome,
  SettingsContentIndex,
  SettingsIndex,
  TechnicalTransactionDetails,
  ViewAllTxPage,
} from './app/screens/inAccount';

import {
  GlobalContextProvider,
  useGlobalContextProvider,
} from './context-store/context';

// const AddChatGPTCredits = lazy(
//   () =>
//     import(
//       './app/components/admin/homeComponents/apps/chatGPT/addCreditsPage.js'
//     ),
// );
// const ConfirmLeaveChatGPT = lazy(
//   () =>
//     import(
//       './app/components/admin/homeComponents/apps/chatGPT/components/confirmLeaveChat.js'
//     ),
// );

import {
  AddChatGPTCredits,
  AddOrDeleteContactImage,
  CameraModal,
  ClipboardCopyPopup,
  ConfirmActionPage,
  // ConfirmAddContact,
  ConfirmLeaveChatGPT,
  ContactsPageLongPressActions,
  EditMyProfilePage,
  EditReceivePaymentInformation,
  ErrorScreen,
  ExpandedContactsPage,
  HalfModalSendOptions,
  // LetterKeyboard,
  LiquidSettingsPage,
  LspDescriptionPopup,
  MyContactProfilePage,

  // RefundBitcoinTransactionPage,
  SendAndRequestPage,
  SendPaymentScreen,
  SwitchReceiveOptionPage,
  // UserBalanceDenomination,
  // ViewInProgressSwap,
} from './app/components/admin';

// import {ContactsDrawer} from './navigation/drawers';

// const AddResturantItemToCart = lazy(
//   () =>
//     import(
//       './app/components/admin/homeComponents/apps/resturantService/addItemToCart.js'
//     ),
// );
// const ResturantCartPage = lazy(
//   () =>
//     import(
//       './app/components/admin/homeComponents/apps/resturantService/cartPage.js'
//     ),
// );
// const ManualEnterSendAddress = lazy(
//   () =>
//     import(
//       './app/components/admin/homeComponents/homeLightning/manualEnterSendAddress'
//     ),
// );
import AddResturantItemToCart from './app/components/admin/homeComponents/apps/resturantService/addItemToCart';
import ResturantCartPage from './app/components/admin/homeComponents/apps/resturantService/cartPage';
import ManualEnterSendAddress from './app/components/admin/homeComponents/homeLightning/manualEnterSendAddress';
import {WebViewProvider} from './context-store/webViewContext';
import {Linking, Platform} from 'react-native';

// const ConfirmExportPayments = lazy(
//   () =>
//     import(
//       './app/components/admin/homeComponents/exportTransactions/exportTracker.js'
//     ),
// );
// const HistoricalVPNPurchases = lazy(
//   () =>
//     import(
//       './app/components/admin/homeComponents/apps/VPN/historicalPurchasesPage.js'
//     ),
// );
// const GeneratedVPNFile = lazy(
//   () =>
//     import(
//       './app/components/admin/homeComponents/apps/VPN/pages/generatedFile.js'
//     ),
// );
// const ConfirmVPNPage = lazy(
//   () =>
//     import(
//       './app/components/admin/homeComponents/apps/VPN/components/confirmationSlideUp.js'
//     ),
// );
// const ConfirmSMSPayment = lazy(
//   () =>
//     import(
//       './app/components/admin/homeComponents/apps/sms4sats/confirmationSlideUp.js'
//     ),
// );
import ConfirmExportPayments from './app/components/admin/homeComponents/exportTransactions/exportTracker';
import {
  ClaimGiftCard,
  ConfirmSMSPayment,
  ConfirmVPNPage,
  CountryList,
  CreateGiftCardAccount,
  ExpandedGiftCardPage,
  // ForgotGiftCardPassword,
  GeneratedVPNFile,
  // GiftCardLoginPage,
  GiftCardOrderDetails,
  GiftCardPage,
  HistoricalGiftCardPurchases,
  HistoricalVPNPurchases,
  ResetGiftCardProfilePassword,
  SwitchGenerativeAIModel,
} from './app/components/admin/homeComponents/apps';

// const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';
// import {COLORS} from './app/constants';
import SplashScreen from './app/screens/splashScreen';
import {GlobalContactsList} from './context-store/globalContacts';
import {
  ChooseContactHalfModal,
  ExpandedAddContactsPage,
} from './app/components/admin/homeComponents/contacts';

// const ChooseContactHalfModal = lazy(
//   () =>
//     import(
//       './app/components/admin/homeComponents/contacts/halfModalSendOptionPath/contactsList.js'
//     ),
// );
// const ExpandedAddContactsPage = lazy(
//   () =>
//     import(
//       './app/components/admin/homeComponents/contacts/expandedAddContactsPage.js'
//     ),
// );
import {GlobaleCashVariables} from './context-store/eCash';
// const POSInstructionsPath = lazy(
//   () =>
//     import(
//       './app/components/admin/homeComponents/settingsContent/posPath/posInstructionsPath.js'
//     ),
// );
import POSInstructionsPath from './app/components/admin/homeComponents/settingsContent/posPath/posInstructionsPath';
import FullLoadingScreen from './app/functions/CustomElements/loadingScreen';
import {
  CreateAccountHome,
  DislaimerPage,
  GenerateKey,
  PinSetupPage,
  RestoreWallet,
  SkipCreateAccountPathMessage,
} from './app/screens/createAccount';
import {GlobalAppDataProvider} from './context-store/appData';
// import PushNotificationManager from './context-store/notificationManager';
import CustomHalfModal from './app/functions/CustomElements/halfModal';
import {CustomWebView} from './app/functions/CustomElements';
import ExplainBalanceScreen from './app/components/admin/homeComponents/sendBitcoin/components/balanceExplainerScreen';
import {
  HistoricalOnChainPayments,
  TotalTipsScreen,
  ViewPOSTransactions,
} from './app/components/admin/homeComponents/settingsContent';
import PushNotificationManager, {
  registerBackgroundNotificationTask,
} from './context-store/notificationManager';
import {initializeFirebase} from './db/initializeFirebase';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import GetThemeColors from './app/hooks/themeColors';
import InformationPopup from './app/functions/CustomElements/informationPopup';
import {COLORS, LOGIN_SECUITY_MODE_KEY} from './app/constants';
import RefundLiquidSwapPopup from './app/components/admin/homeComponents/settingsContent/failedLiquidSwapsComponents/refundSwapPopup';
import ManualSwapPopup from './app/components/admin/homeComponents/settingsContent/walletInfoComponents/manualSwapPopup';
import AccountInformationPage from './app/components/admin/homeComponents/settingsContent/walletInfoComponents/AccountInformationPage';
import {LiquidEventProvider} from './context-store/liquidEventContext';
import {
  LightningNavigationListener,
  LiquidNavigationListener,
} from './context-store/SDKNavigation';
import {LightningEventProvider} from './context-store/lightningEventContext';
import HistoricalSMSMessagingPage from './app/components/admin/homeComponents/apps/sms4sats/sentPayments';
import {
  GlobalThemeProvider,
  useGlobalThemeContext,
} from './context-store/theme';
import {GLobalNodeContextProider} from './context-store/nodeContext';
import {AppStatusProvider} from './context-store/appStatus';
import {KeysContextProvider} from './context-store/keys';
import {POSTransactionsProvider} from './context-store/pos';

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
  const handleDeepLink = useCallback(
    (event: {url: string}) => {
      console.log('TEST');
      const {url} = event;

      if (url.startsWith('lightning')) {
        setDeepLinkContent({type: 'LN', data: url});
      } else if (url.includes('blitz')) {
        setDeepLinkContent({type: 'Contact', data: url});
      }

      console.log('Deep link URL:', url); // Log the URL
    },
    [setDeepLinkContent],
  );

  // Memoize getInitialURL
  const getInitialURL = useCallback(async () => {
    const url = await Linking.getInitialURL();
    if (url) {
      handleDeepLink({url});
    }
  }, [handleDeepLink]);

  useEffect(() => {
    const subscription = Linking.addListener('url', handleDeepLink);

    async function initWallet() {
      const [
        initialURL,
        registerBackground,
        pin,
        mnemonic,
        // initFirebase,
        securitySettings,
      ] = await Promise.all([
        await getInitialURL(),
        await registerBackgroundNotificationTask(),
        await retrieveData('pin'),
        await retrieveData('mnemonic'),
        // await initializeFirebase(),
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

  if (!initSettings.isLoaded || theme === null || darkModeType === null) {
    return <SplashScreen onAnimationFinish={handleAnimationFinish} />;
  }
  return (
    <NavigationContainer
      theme={{
        dark: theme,
        colors: {
          background: backgroundColor,
          primary: '',
          card: '',
          text: '',
          border: '',
          notification: '',
        },
      }}
      ref={navigationRef}>
      <LiquidNavigationListener />
      <LightningNavigationListener />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          statusBarColor:
            Platform.OS === 'android'
              ? theme
                ? darkModeType
                  ? COLORS.lightsOutBackground
                  : COLORS.darkModeBackground
                : COLORS.lightModeBackground
              : undefined,
          statusBarStyle:
            Platform.OS === 'android' ? (theme ? 'light' : 'dark') : undefined,
          statusBarAnimation: Platform.OS === 'android' ? 'fade' : undefined,
          navigationBarColor: theme
            ? darkModeType
              ? COLORS.lightsOutBackground
              : COLORS.darkModeBackground
            : COLORS.lightModeBackground,
        }}>
        <Stack.Screen
          name="Home"
          component={
            initSettings.isLoggedIn
              ? initSettings.hasSecurityEnabled
                ? AdminLogin
                : ConnectingToNodeLoadingScreen
              : CreateAccountHome
          }
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
        {/* <Stack.Screen
          name="AddResturantItemToCart"
          component={AddResturantItemToCart}
          options={{
            animation: 'fade',
            gestureEnabled: false,
            presentation: 'transparentModal',
          }}
        /> */}

        <Stack.Screen
          name="ConfirmTxPage"
          component={ConfirmTxPage}
          options={{
            animation: 'fade',
            // gestureEnabled: false,
            // presentation: 'transparentModal',
          }}
        />
        <Stack.Screen
          name="RefundLiquidSwapPopup"
          component={RefundLiquidSwapPopup}
          options={{
            animation: 'fade',

            presentation: 'transparentModal',
          }}
        />
        <Stack.Screen
          name="TotalTipsScreen"
          component={TotalTipsScreen}
          options={{
            animation: 'fade',
            presentation: 'transparentModal',
          }}
        />

        {/* Create Account screens */}
        <Stack.Screen name="DisclaimerPage" component={DislaimerPage} />
        <Stack.Screen name="GenerateKey" component={GenerateKey} />
        <Stack.Screen name="PinSetup" component={PinSetupPage} />
        <Stack.Screen name="RestoreWallet" component={RestoreWallet} />

        {/* admin screens */}
        <Stack.Screen
          name="HomeAdmin"
          component={AdminHomeIndex}
          options={{animation: 'fade', gestureEnabled: false}}
        />

        <Stack.Group
          screenOptions={{
            presentation: 'containedTransparentModal',
            animation: 'slide_from_bottom',
          }}>
          <Stack.Screen
            name="ConfirmSMSPayment"
            component={ConfirmSMSPayment}
          />
          <Stack.Screen name="ConfirmVPNPage" component={ConfirmVPNPage} />

          <Stack.Screen
            name="ConfirmExportPayments"
            component={ConfirmExportPayments}
          />
          <Stack.Screen name="CustomWebView" component={CustomWebView} />

          <Stack.Screen name="SendBTC" component={SendPaymentHome} />
          <Stack.Screen name="ReceiveBTC" component={ReceivePaymentHome} />
          <Stack.Screen name="ExpandedTx" component={ExpandedTx} />
          <Stack.Screen
            name="TechnicalTransactionDetails"
            component={TechnicalTransactionDetails}
          />
          <Stack.Screen
            name="LiquidSettingsPage"
            component={LiquidSettingsPage}
          />

          <Stack.Screen
            name="EditReceivePaymentInformation"
            component={EditReceivePaymentInformation}
          />

          <Stack.Screen
            name="SwitchReceiveOptionPage"
            component={SwitchReceiveOptionPage}
          />

          <Stack.Screen name="ViewAllTxPage" component={ViewAllTxPage} />
          <Stack.Screen name="CameraModal" component={CameraModal} />

          {/* <Stack.Screen
            options={{gestureEnabled: false}}
            name="AddChatGPTCredits"
            component={AddChatGPTCredits}
          /> */}
          {/* <Stack.Screen
            options={{gestureEnabled: false}}
            name="ResturantCartPage"
            component={ResturantCartPage}
          /> */}
          <Stack.Screen
            name="SwitchGenerativeAIModel"
            component={SwitchGenerativeAIModel}
          />
        </Stack.Group>
        <Stack.Group
          screenOptions={{
            animation: 'slide_from_right',
          }}>
          <Stack.Screen name="SettingsHome" component={SettingsIndex} />
          <Stack.Screen
            name="HistoricalOnChainPayments"
            component={HistoricalOnChainPayments}
          />
          <Stack.Screen
            name="ChooseContactHalfModal"
            component={ChooseContactHalfModal}
          />
          <Stack.Screen
            name="SettingsContentHome"
            component={SettingsContentIndex}
          />
          <Stack.Screen
            options={{gestureEnabled: false}}
            name="ConfirmPaymentScreen"
            component={SendPaymentScreen}
          />
          {/* SWAP PAGES  */}
          {/* <Stack.Screen
            name="RefundBitcoinTransactionPage"
            component={RefundBitcoinTransactionPage}
          /> */}
          {/* <Stack.Screen
            name="viewInProgressSwap"
            component={ViewInProgressSwap}
          /> */}
          {/* contacts */}
          <Stack.Screen
            name="ExpandedContactsPage"
            component={ExpandedContactsPage}
          />
          <Stack.Screen
            name="MyContactProfilePage"
            component={MyContactProfilePage}
          />
          <Stack.Screen
            name="EditMyProfilePage"
            component={EditMyProfilePage}
          />
          <Stack.Screen
            name="ExpandedAddContactsPage"
            component={ExpandedAddContactsPage}
          />
          <Stack.Screen
            name="SendAndRequestPage"
            component={SendAndRequestPage}
          />
          {/* App Store */}
          <Stack.Screen
            name="AppStorePageIndex"
            component={AppStorePageIndex}
          />

          <Stack.Screen
            name="HistoricalSMSMessagingPage"
            component={HistoricalSMSMessagingPage}
          />
          <Stack.Screen
            name="HistoricalVPNPurchases"
            component={HistoricalVPNPurchases}
          />
          <Stack.Screen name="GeneratedVPNFile" component={GeneratedVPNFile} />
          <Stack.Screen
            name="POSInstructionsPath"
            component={POSInstructionsPath}
          />
          <Stack.Screen
            name="ManualyEnterSendAddress"
            component={ManualEnterSendAddress}
          />
          {/* <Stack.Screen
            name="GiftCardLoginPage"
            component={GiftCardLoginPage}
          /> */}
          <Stack.Screen
            name="CreateGiftCardAccount"
            component={CreateGiftCardAccount}
          />
          <Stack.Screen name="GiftCardsPage" component={GiftCardPage} />
          <Stack.Screen name="CountryList" component={CountryList} />
          {/* <Stack.Screen
            name="ForgotGiftCardPassword"
            component={ForgotGiftCardPassword}
          /> */}
          <Stack.Screen
            name="ResetGiftCardProfilePassword"
            component={ResetGiftCardProfilePassword}
          />
          <Stack.Screen
            name="ExpandedGiftCardPage"
            component={ExpandedGiftCardPage}
          />
          <Stack.Screen
            name="HistoricalGiftCardPurchases"
            component={HistoricalGiftCardPurchases}
          />
          <Stack.Screen name="ClaimGiftCard" component={ClaimGiftCard} />
          <Stack.Screen name="ManualSwapPopup" component={ManualSwapPopup} />
          <Stack.Screen
            name="AccountInformationPage"
            component={AccountInformationPage}
          />
          <Stack.Screen
            name="ViewPOSTransactions"
            component={ViewPOSTransactions}
          />
        </Stack.Group>
        <Stack.Group
          screenOptions={{
            animation: 'fade',
            presentation: 'containedTransparentModal',
          }}>
          <Stack.Screen name="ConnectionToNode" component={ConnectionToNode} />

          <Stack.Screen
            name="HalfModalSendOption"
            component={HalfModalSendOptions}
          />
          <Stack.Screen name="CustomHalfModal" component={CustomHalfModal} />
          <Stack.Screen
            name="ConfirmActionPage"
            component={ConfirmActionPage}
          />
          <Stack.Screen
            name="ConfirmLeaveChatGPT"
            component={ConfirmLeaveChatGPT}
          />
          <Stack.Screen
            name="ClipboardCopyPopup"
            component={ClipboardCopyPopup}
          />

          <Stack.Screen name="ErrorScreen" component={ErrorScreen} />
          <Stack.Screen
            name="ExplainBalanceScreen"
            component={ExplainBalanceScreen}
          />

          <Stack.Screen
            name="GiftCardOrderDetails"
            component={GiftCardOrderDetails}
          />
          <Stack.Screen
            name="ContactsPageLongPressActions"
            component={ContactsPageLongPressActions}
          />
          {/* <Stack.Screen name="LetterKeyboard" component={LetterKeyboard} /> */}
          {/* <Stack.Screen
            name="ConfirmAddContact"
            component={ConfirmAddContact}
          /> */}
          <Stack.Screen
            name="AddOrDeleteContactImage"
            component={AddOrDeleteContactImage}
          />
          {/* <Stack.Screen
            name="UserBalanceDenomination"
            component={UserBalanceDenomination}
          /> */}
          <Stack.Screen
            name="SkipCreateAccountPathMessage"
            component={SkipCreateAccountPathMessage}
          />
          <Stack.Screen name="InformationPopup" component={InformationPopup} />
        </Stack.Group>

        <Stack.Screen
          name="LspDescriptionPopup"
          component={LspDescriptionPopup}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// TaskManager.defineTask(
//   BACKGROUND_NOTIFICATION_TASK,
//   ({data, error, executionInfo}) => {
//     (async () => {
//       console.log(data);
//       console.log(executionInfo);
//       const paymentInformationFromNotification = data?.body;
//       console.log(paymentInformationFromNotification);

//       if (paymentInformationFromNotification.pr) {
//         try {
//           await sendPayment({
//             bolt11: paymentInformationFromNotification.pr,
//           });
//         } catch (err) {
//           console.log(err);
//         }
//         return;
//       }

//       const didConnect = await connectToNode(globalOnBreezEvent);
//       console.log(didConnect);
//       if (didConnect.isConnected) return;
//       Notifications.cancelAllScheduledNotificationsAsync();

//       try {
//         await Notifications.scheduleNotificationAsync({
//           content: {
//             title: 'Blitz Wallet',
//             body: `Caught incoming payment`,
//           },
//           trigger: {
//             seconds: 2,
//           },
//         });
//         await Notifications.scheduleNotificationAsync({
//           content: {
//             title: 'Blitz Wallet',
//             body: 'Getting invoice details',
//           },
//           trigger: {
//             seconds: 2,
//           },
//         });
//       } catch (err) {
//         console.log(err);
//       }

//       console.log('Received a notification in the background!', 'TTTTT');

//       // Do something with the notification data
//     })();
//   },
// );

// Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);

export default App;
registerRootComponent(App);
